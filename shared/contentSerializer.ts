import type { TiptapOutputFormat } from './types';

export interface ProseMirrorJSONNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorJSONNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

const SAFE_URL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:', 'strapi:']);

/**
 * Decodes HTML character references (named & numeric decimal/hex) and strips control characters
 * so obfuscated schemes like `java&#x09;script:` or `&#106;avascript:` are caught.
 */
function decodeHtmlEntitiesForUrlCheck(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Escapes special HTML attribute characters (`&`, `<`, `>`, `"`, `'`).
 */
function escAttr(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Unescapes HTML entities in Markdown/HTML text segments.
 */
function unescapeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Validates that a URL uses a safe protocol or is a relative/anchor link.
 * Blocks `javascript:`, `vbscript:`, `data:text/html`, and protocol-relative `//` or `/\` URLs.
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const decoded = decodeHtmlEntitiesForUrlCheck(url);
  const trimmed = decoded.trim();
  if (!trimmed) return false;

  const normalized = trimmed.replace(/[\u0000-\u001F\s]/g, '');
  if (!normalized) return false;

  // Relative paths and anchor links (disallow protocol-relative // or /\)
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return !/^[\/\\]{2}/.test(normalized);
  }

  // Internal Strapi link protocol
  if (normalized.toLowerCase().startsWith('strapi://')) {
    return true;
  }

  const lower = normalized.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return false;
  }

  // Allow safe data:image/* (except svg+xml which can embed scripts) and data:audio/*
  if (lower.startsWith('data:image/')) {
    return !lower.startsWith('data:image/svg');
  }
  if (lower.startsWith('data:audio/')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Validates an iframe embed URL against HTTPS requirement and optional domain allowlist.
 */
export function isSafeIframeUrl(url: string, allowedDomains?: string[]): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;

    if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
      const host = parsed.hostname.toLowerCase();
      return allowedDomains.some((domain) => {
        const cleanDomain = domain.trim().toLowerCase();
        return cleanDomain.length > 0 && (host === cleanDomain || host.endsWith(`.${cleanDomain}`));
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes an HTML string by removing dangerous tags (`<script>`, `<style>`, `<svg>`, `<form>`,
 * `<object>`, `<embed>`, `<applet>`, `<base>`, `<meta>`, `<link>`), inline `on*` event attributes,
 * `srcdoc` attributes, and unsafe URLs in `href`/`src`/`action`/`formaction`/`xlink:href`.
 */
export function sanitizeHtmlString(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let sanitized = html
    // Remove paired dangerous container elements and their contents
    .replace(/<\s*(script|style|svg|math|object|embed|applet)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Remove standalone or unclosed dangerous tags (including form, base, meta, link)
    .replace(/<\s*\/?\s*(script|style|svg|math|form|object|embed|applet|base|meta|link)\b[^>]*>/gi, '')
    // Remove event handler attributes (e.g. onclick="...", /onerror=alert(1), onload='...')
    .replace(
      /(?:[\s/"']|^)on[a-z0-9_]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']*)/gi,
      (match) => (match.startsWith('"') || match.startsWith("'") ? match[0] : '')
    )
    // Remove iframe srcdoc attributes (quoted or unquoted)
    .replace(/(?:[\s/"']|^)srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']*)/gi, (match) =>
      match.startsWith('"') || match.startsWith("'") ? match[0] : ''
    );

  // Sanitize URL-bearing attributes (double-quoted, single-quoted, or unquoted)
  sanitized = sanitized.replace(
    /\b(href|src|action|formaction|xlink:href|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi,
    (_full, attr: string, dq?: string, sq?: string, uq?: string) => {
      const rawVal = dq ?? sq ?? uq ?? '';
      if (isSafeUrl(rawVal)) {
        return `${attr}="${escAttr(rawVal.trim())}"`;
      }
      return `${attr}="#"`;
    }
  );

  return sanitized;
}

/**
 * Formats and validates a URL for safe inclusion inside Markdown link/media syntax.
 */
function mdUrl(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (!str || !isSafeUrl(str)) return '#';
  return /[\s()]/.test(str) ? `<${str.replace(/>/g, '%3E')}>` : str;
}

/**
 * Serializes inline ProseMirror nodes and marks to Markdown.
 */
function serializeInline(nodes?: ProseMirrorJSONNode[]): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '  \n';
      if (node.type === 'linker') {
        const label = String(node.attrs?.label || node.attrs?.documentId || 'Link');
        const collection = String(node.attrs?.collectionName || 'document');
        const docId = String(node.attrs?.documentId || '');
        const rawHref = String(node.attrs?.href || `strapi://${collection}/${docId}`);
        return `[${label}](${mdUrl(rawHref)})`;
      }
      if (node.type === 'mathematics') {
        const latex = String(node.attrs?.latex || '');
        return `$${latex}$`;
      }
      if (node.type !== 'text' || typeof node.text !== 'string') {
        return jsonToMarkdown(node);
      }

      const marks = Array.isArray(node.marks) ? node.marks : [];
      const hasCodeMark = marks.some((m) => m.type === 'code');
      let text = hasCodeMark
        ? node.text
        : node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      for (const mark of marks) {
        switch (mark.type) {
          case 'code':
            text = `\`${text}\``;
            break;
          case 'bold':
            text = `**${text}**`;
            break;
          case 'italic':
            text = `*${text}*`;
            break;
          case 'strike':
            text = `~~${text}~~`;
            break;
          case 'underline':
            text = `<u>${text}</u>`;
            break;
          case 'superscript':
            text = `<sup>${text}</sup>`;
            break;
          case 'subscript':
            text = `<sub>${text}</sub>`;
            break;
          case 'link': {
            const href = mdUrl(mark.attrs?.href);
            text = `[${text}](${href})`;
            break;
          }
          case 'abbr': {
            const title = escAttr(mark.attrs?.title);
            text = title ? `<abbr title="${title}">${text}</abbr>` : text;
            break;
          }
          case 'language': {
            const lang = escAttr(mark.attrs?.lang);
            const dir = escAttr(mark.attrs?.dir || 'ltr');
            text = lang ? `<span lang="${lang}" dir="${dir}">${text}</span>` : text;
            break;
          }
          default:
            break;
        }
      }
      return text;
    })
    .join('');
}

/**
 * Converts a ProseMirror JSON document tree into Markdown.
 */
export function jsonToMarkdown(doc: ProseMirrorJSONNode | null | undefined): string {
  if (!doc || typeof doc !== 'object') return '';

  const blocks = Array.isArray(doc.content) ? doc.content : [];
  const lines: string[] = [];

  for (const node of blocks) {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
        lines.push(`${'#'.repeat(level)} ${serializeInline(node.content)}`);
        break;
      }
      case 'leadParagraph': {
        lines.push(`> **Lead:** ${serializeInline(node.content)}`);
        break;
      }
      case 'paragraph': {
        lines.push(serializeInline(node.content));
        break;
      }
      case 'blockquote': {
        const inner = jsonToMarkdown(node)
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        lines.push(inner);
        break;
      }
      case 'informationPane': {
        const variant = String(node.attrs?.variant || 'info').toUpperCase();
        const title = String(node.attrs?.title || variant);
        const body = jsonToMarkdown(node)
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        lines.push(`> [!${variant}] ${title}\n${body}`);
        break;
      }
      case 'conversationHistory': {
        const author = String(node.attrs?.author || 'Comment');
        const body = jsonToMarkdown(node)
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
        lines.push(`> **Conversation History** *(${author})*\n${body}`);
        break;
      }
      case 'details': {
        const summaryNode = node.content?.find((c) => c.type === 'detailsSummary');
        const contentNode = node.content?.find((c) => c.type === 'detailsContent');
        const summaryText = serializeInline(summaryNode?.content) || 'Details';
        const bodyText = contentNode ? jsonToMarkdown(contentNode) : '';
        lines.push(`<details>\n<summary>${summaryText}</summary>\n\n${bodyText}\n</details>`);
        break;
      }
      case 'codeBlock': {
        const lang = String(node.attrs?.language || '');
        const codeText = (node.content || []).map((c) => c.text || '').join('');
        lines.push(`\`\`\`${lang}\n${codeText}\n\`\`\``);
        break;
      }
      case 'bulletList': {
        const items = (node.content || []).map((item) => `- ${jsonToMarkdown(item).trim()}`);
        lines.push(items.join('\n'));
        break;
      }
      case 'orderedList': {
        const items = (node.content || []).map(
          (item, idx) => `${idx + 1}. ${jsonToMarkdown(item).trim()}`
        );
        lines.push(items.join('\n'));
        break;
      }
      case 'taskList': {
        const items = (node.content || []).map((item) => {
          const checked = item.attrs?.checked ? 'x' : ' ';
          return `- [${checked}] ${jsonToMarkdown(item).trim()}`;
        });
        lines.push(items.join('\n'));
        break;
      }
      case 'listItem':
      case 'taskItem': {
        lines.push((node.content || []).map((c) => serializeInline(c.content)).join('\n'));
        break;
      }
      case 'horizontalRule': {
        lines.push('---');
        break;
      }
      case 'pageBreak': {
        lines.push('<!-- pagebreak -->');
        break;
      }
      case 'image': {
        const alt = String(node.attrs?.alt || '');
        const src = mdUrl(node.attrs?.src);
        lines.push(`![${alt}](${src})`);
        break;
      }
      case 'video': {
        const src = mdUrl(node.attrs?.src);
        const title = String(node.attrs?.title || 'Video');
        lines.push(`[Video: ${title}](${src})`);
        break;
      }
      case 'audio': {
        const src = mdUrl(node.attrs?.src);
        const title = String(node.attrs?.title || 'Audio');
        lines.push(`[Audio: ${title}](${src})`);
        break;
      }
      case 'attachment': {
        const href = mdUrl(node.attrs?.href || node.attrs?.src);
        const filename = String(node.attrs?.filename || node.attrs?.title || 'Attachment');
        lines.push(`[Attachment: ${filename}](${href})`);
        break;
      }
      case 'iframe': {
        const rawSrc = String(node.attrs?.src || '');
        const src = isSafeIframeUrl(rawSrc) ? mdUrl(rawSrc) : '#';
        const title = String(node.attrs?.title || 'Embed');
        lines.push(`[Embed: ${title}](${src})`);
        break;
      }
      case 'mathematics': {
        const latex = String(node.attrs?.latex || '');
        const isBlock =
          node.attrs?.displayMode === 'block' || node.attrs?.displayMode === true;
        lines.push(isBlock ? `$$\n${latex}\n$$` : `$${latex}$`);
        break;
      }
      case 'table': {
        const rows = node.content || [];
        const mdRows: string[] = [];
        rows.forEach((row, rIdx) => {
          const cells = (row.content || []).map((cell) => jsonToMarkdown(cell).replace(/\n+/g, ' ').trim());
          mdRows.push(`| ${cells.join(' | ')} |`);
          if (rIdx === 0) {
            mdRows.push(`| ${cells.map(() => '---').join(' | ')} |`);
          }
        });
        lines.push(mdRows.join('\n'));
        break;
      }
      case 'tableCell':
      case 'tableHeader': {
        lines.push((node.content || []).map((c) => serializeInline(c.content)).join(' '));
        break;
      }
      case 'layoutContainer': {
        const cols = (node.content || []).map((col) => jsonToMarkdown(col));
        lines.push(cols.join('\n\n'));
        break;
      }
      case 'layoutColumn': {
        lines.push(jsonToMarkdown({ type: 'doc', content: node.content }));
        break;
      }
      default: {
        if (Array.isArray(node.content)) {
          lines.push(serializeInline(node.content));
        }
        break;
      }
    }
  }

  return lines.filter((l) => l !== undefined).join('\n\n');
}

/**
 * Unwraps `<...>` around Markdown URLs and validates safety.
 */
function parseMdUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const unwrapped =
    trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).trim() : trimmed;
  return isSafeUrl(unwrapped) ? unwrapped : '#';
}

/**
 * Parses inline Markdown and safe inline HTML marks into ProseMirror text/inline nodes.
 */
export function parseInlineMarkdown(
  input: string,
  inheritedMarks: Array<{ type: string; attrs?: Record<string, unknown> }> = []
): ProseMirrorJSONNode[] {
  if (!input) return [];

  const nodes: ProseMirrorJSONNode[] = [];
  const tokenRegex =
    /(\$([^$\n]+)\$|!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)|\[([^\]]+)\]\((<[^>]+>|[^)]+)\)|`([^`]+)`|\*\*([\s\S]+?)\*\*|~~([\s\S]+?)~~|\*([^*]+)\*|<(u|sup|sub)>([\s\S]*?)<\/\1>|<abbr\s+title="([^"]*)"\s*>([\s\S]*?)<\/abbr>|<span\s+lang="([^"]*)"(?:\s+dir="([^"]*)")?\s*>([\s\S]*?)<\/span>)/;

  let remaining = input;
  while (remaining.length > 0) {
    const match = tokenRegex.exec(remaining);
    if (!match) {
      const plain = unescapeHtmlEntities(remaining);
      if (plain) {
        nodes.push({
          type: 'text',
          text: plain,
          ...(inheritedMarks.length > 0 ? { marks: inheritedMarks } : {}),
        });
      }
      break;
    }

    if (match.index > 0) {
      const prefix = unescapeHtmlEntities(remaining.slice(0, match.index));
      if (prefix) {
        nodes.push({
          type: 'text',
          text: prefix,
          ...(inheritedMarks.length > 0 ? { marks: inheritedMarks } : {}),
        });
      }
    }

    const [
      fullMatch,
      ,
      mathLatex,
      imgAlt,
      imgSrc,
      linkText,
      linkHref,
      codeText,
      boldInner,
      strikeInner,
      italicInner,
      htmlSimpleTag,
      htmlSimpleInner,
      abbrTitle,
      abbrInner,
      spanLang,
      spanDir,
      spanInner,
    ] = match;

    if (mathLatex !== undefined) {
      nodes.push({
        type: 'mathematics',
        attrs: { latex: mathLatex, displayMode: 'inline' },
      });
    } else if (imgSrc !== undefined) {
      nodes.push({
        type: 'image',
        attrs: { src: parseMdUrl(imgSrc), alt: unescapeHtmlEntities(imgAlt || '') },
      });
    } else if (linkText !== undefined && linkHref !== undefined) {
      const safeHref = parseMdUrl(linkHref);
      const strapiMatch = /^strapi:\/\/([^/]+)\/(.+)$/i.exec(safeHref);
      if (strapiMatch) {
        nodes.push({
          type: 'linker',
          attrs: {
            collectionName: strapiMatch[1],
            documentId: strapiMatch[2],
            label: unescapeHtmlEntities(linkText),
            href: safeHref,
          },
        });
      } else {
        nodes.push(
          ...parseInlineMarkdown(linkText, [
            ...inheritedMarks,
            { type: 'link', attrs: { href: safeHref } },
          ])
        );
      }
    } else if (codeText !== undefined) {
      nodes.push({
        type: 'text',
        text: codeText,
        marks: [...inheritedMarks, { type: 'code' }],
      });
    } else if (boldInner !== undefined) {
      nodes.push(...parseInlineMarkdown(boldInner, [...inheritedMarks, { type: 'bold' }]));
    } else if (strikeInner !== undefined) {
      nodes.push(...parseInlineMarkdown(strikeInner, [...inheritedMarks, { type: 'strike' }]));
    } else if (italicInner !== undefined) {
      nodes.push(...parseInlineMarkdown(italicInner, [...inheritedMarks, { type: 'italic' }]));
    } else if (htmlSimpleTag !== undefined && htmlSimpleInner !== undefined) {
      const markType =
        htmlSimpleTag === 'u'
          ? 'underline'
          : htmlSimpleTag === 'sup'
            ? 'superscript'
            : 'subscript';
      nodes.push(...parseInlineMarkdown(htmlSimpleInner, [...inheritedMarks, { type: markType }]));
    } else if (abbrTitle !== undefined && abbrInner !== undefined) {
      nodes.push(
        ...parseInlineMarkdown(abbrInner, [
          ...inheritedMarks,
          { type: 'abbr', attrs: { title: unescapeHtmlEntities(abbrTitle) } },
        ])
      );
    } else if (spanLang !== undefined && spanInner !== undefined) {
      nodes.push(
        ...parseInlineMarkdown(spanInner, [
          ...inheritedMarks,
          {
            type: 'language',
            attrs: {
              lang: unescapeHtmlEntities(spanLang),
              dir: unescapeHtmlEntities(spanDir || 'ltr'),
            },
          },
        ])
      );
    }

    remaining = remaining.slice(match.index + fullMatch.length);
  }

  return nodes;
}

/**
 * Parses a Markdown string into a ProseMirror JSON document tree.
 */
export function markdownToJson(markdown: string): ProseMirrorJSONNode {
  if (!markdown || typeof markdown !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const normalized = markdown.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const content: ProseMirrorJSONNode[] = [];

  for (const rawBlock of blocks) {
    const trimmed = rawBlock.trim();
    if (!trimmed) continue;

    // Fenced code block
    if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
      const firstNewline = trimmed.indexOf('\n');
      const language = firstNewline > 3 ? trimmed.slice(3, firstNewline).trim() : null;
      const code = firstNewline > -1 ? trimmed.slice(firstNewline + 1, -3) : '';
      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: code ? [{ type: 'text', text: code }] : [],
      });
      continue;
    }

    // Display math block $$ ... $$
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
      const latex = trimmed.slice(2, -2).trim();
      content.push({
        type: 'mathematics',
        attrs: { latex, displayMode: 'block' },
      });
      continue;
    }

    // Collapsible <details> block
    const detailsMatch =
      /^<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)\s*<\/details>$/i.exec(trimmed);
    if (detailsMatch) {
      const summaryInline = parseInlineMarkdown(detailsMatch[1].trim());
      const bodyDoc = markdownToJson(detailsMatch[2].trim());
      content.push({
        type: 'details',
        attrs: { open: true },
        content: [
          {
            type: 'detailsSummary',
            content: summaryInline.length > 0 ? summaryInline : [{ type: 'text', text: 'Details' }],
          },
          {
            type: 'detailsContent',
            content:
              bodyDoc.content && bodyDoc.content.length > 0
                ? bodyDoc.content
                : [{ type: 'paragraph' }],
          },
        ],
      });
      continue;
    }

    // Page break
    if (/^<!--\s*pagebreak\s*-->$/i.test(trimmed)) {
      content.push({ type: 'pageBreak' });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      content.push({ type: 'horizontalRule' });
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const inlineNodes = parseInlineMarkdown(headingMatch[2]);
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: inlineNodes,
      });
      continue;
    }

    // Standalone media / embed lines
    const videoMatch = /^\[Video:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
    if (videoMatch) {
      content.push({
        type: 'video',
        attrs: {
          title: unescapeHtmlEntities(videoMatch[1].trim() || 'Video'),
          src: parseMdUrl(videoMatch[2]),
        },
      });
      continue;
    }

    const audioMatch = /^\[Audio:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
    if (audioMatch) {
      content.push({
        type: 'audio',
        attrs: {
          title: unescapeHtmlEntities(audioMatch[1].trim() || 'Audio'),
          src: parseMdUrl(audioMatch[2]),
        },
      });
      continue;
    }

    const attachmentMatch = /^\[Attachment:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
    if (attachmentMatch) {
      const href = parseMdUrl(attachmentMatch[2]);
      const filename = unescapeHtmlEntities(attachmentMatch[1].trim() || 'Attachment');
      content.push({
        type: 'attachment',
        attrs: { href, src: href, filename, title: filename },
      });
      continue;
    }

    const embedMatch = /^\[Embed:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
    if (embedMatch) {
      const rawUrl = embedMatch[2].trim();
      const unwrapped =
        rawUrl.startsWith('<') && rawUrl.endsWith('>') ? rawUrl.slice(1, -1).trim() : rawUrl;
      content.push({
        type: 'iframe',
        attrs: {
          title: unescapeHtmlEntities(embedMatch[1].trim() || 'Embed'),
          src: isSafeIframeUrl(unwrapped) ? unwrapped : '',
        },
      });
      continue;
    }

    const standaloneImgMatch = /^!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)$/.exec(trimmed);
    if (standaloneImgMatch) {
      content.push({
        type: 'image',
        attrs: {
          alt: unescapeHtmlEntities(standaloneImgMatch[1]),
          src: parseMdUrl(standaloneImgMatch[2]),
        },
      });
      continue;
    }

    // Markdown table
    const lines = trimmed.split('\n');
    if (
      lines.length >= 2 &&
      lines.every((l) => l.trim().startsWith('|') && l.trim().endsWith('|')) &&
      /^\|[\s:-]+(\|[\s:-]+)*\|$/.test(lines[1].trim())
    ) {
      const parseCells = (line: string) =>
        line
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

      const headerCells = parseCells(lines[0]);
      const bodyLines = lines.slice(2);
      const tableRows: ProseMirrorJSONNode[] = [
        {
          type: 'tableRow',
          content: headerCells.map((cellText) => ({
            type: 'tableHeader',
            content: [{ type: 'paragraph', content: parseInlineMarkdown(cellText) }],
          })),
        },
        ...bodyLines.map((rowLine) => ({
          type: 'tableRow',
          content: parseCells(rowLine).map((cellText) => ({
            type: 'tableCell',
            content: [{ type: 'paragraph', content: parseInlineMarkdown(cellText) }],
          })),
        })),
      ];
      content.push({ type: 'table', content: tableRows });
      continue;
    }

    // Task list
    if (lines.every((l) => /^-\s+\[([ xX])\]\s+/.test(l))) {
      content.push({
        type: 'taskList',
        content: lines.map((l) => {
          const checked = /^-\s+\[[xX]\]/.test(l);
          const text = l.replace(/^-\s+\[[ xX]\]\s+/, '');
          return {
            type: 'taskItem',
            attrs: { checked },
            content: [{ type: 'paragraph', content: parseInlineMarkdown(text) }],
          };
        }),
      });
      continue;
    }

    // Bullet list
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      content.push({
        type: 'bulletList',
        content: lines.map((l) => ({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: parseInlineMarkdown(l.replace(/^[-*]\s+/, '')) },
          ],
        })),
      });
      continue;
    }

    // Ordered list
    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      content.push({
        type: 'orderedList',
        attrs: { start: 1 },
        content: lines.map((l) => ({
          type: 'listItem',
          content: [
            { type: 'paragraph', content: parseInlineMarkdown(l.replace(/^\d+\.\s+/, '')) },
          ],
        })),
      });
      continue;
    }

    // Blockquote / Lead / InformationPane / ConversationHistory
    if (lines.every((l) => /^>\s?/.test(l))) {
      const strippedLines = lines.map((l) => l.replace(/^>\s?/, ''));
      const firstLine = strippedLines[0] || '';

      const leadMatch = /^\*\*Lead:\*\*\s*(.+)$/i.exec(firstLine);
      if (leadMatch && strippedLines.length === 1) {
        content.push({
          type: 'leadParagraph',
          content: parseInlineMarkdown(leadMatch[1]),
        });
        continue;
      }

      const infoMatch = /^\[!(INFO|SUCCESS|WARNING|DANGER)\]\s*(.*)$/i.exec(firstLine);
      if (infoMatch) {
        const variant = infoMatch[1].toLowerCase();
        const title = infoMatch[2].trim() || infoMatch[1];
        const bodyText = strippedLines.slice(1).join('\n').trim();
        content.push({
          type: 'informationPane',
          attrs: { variant, title },
          content: [
            {
              type: 'paragraph',
              content: bodyText ? parseInlineMarkdown(bodyText) : [],
            },
          ],
        });
        continue;
      }

      const convMatch = /^\*\*Conversation History\*\*\s*\*\(([^)]*)\)\*$/i.exec(firstLine);
      if (convMatch) {
        const author = convMatch[1].trim() || 'Comment';
        const bodyText = strippedLines.slice(1).join('\n').trim();
        content.push({
          type: 'conversationHistory',
          attrs: { author },
          content: [
            {
              type: 'paragraph',
              content: bodyText ? parseInlineMarkdown(bodyText) : [],
            },
          ],
        });
        continue;
      }

      content.push({
        type: 'blockquote',
        content: strippedLines.map((line) => ({
          type: 'paragraph',
          content: parseInlineMarkdown(line),
        })),
      });
      continue;
    }

    // Standard paragraph
    content.push({
      type: 'paragraph',
      content: parseInlineMarkdown(trimmed),
    });
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

/**
 * Serializes a Tiptap editor instance into the configured output format (`json`, `html`, or `markdown`).
 */
export function serializeEditorContent(
  editor: {
    getJSON: () => unknown;
    getHTML: () => string;
  },
  outputFormat: TiptapOutputFormat = 'json'
): string {
  switch (outputFormat) {
    case 'html':
      return sanitizeHtmlString(editor.getHTML());
    case 'markdown':
      return jsonToMarkdown(editor.getJSON() as ProseMirrorJSONNode);
    case 'json':
    default:
      return JSON.stringify(editor.getJSON());
  }
}
