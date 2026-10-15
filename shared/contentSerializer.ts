import DOMPurify from 'isomorphic-dompurify';
import type { TiptapOutputFormat } from './types';

export interface ProseMirrorJSONNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorJSONNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

const SAFE_URL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:', 'strapi:']);

const DOMPURIFY_ALLOWED_URI_REGEXP =
  /^(?:https?:|mailto:|tel:|strapi:\/\/|data:image\/(?:png|jpe?g|gif|webp|avif);|data:audio\/|\/(?!\/|\\)|#|\.\.?\/)/i;

const DOMPURIFY_ADD_TAGS = ['iframe', 'details', 'summary', 'abbr', 'mark'];

const DOMPURIFY_FORBID_TAGS = [
  'script',
  'style',
  'svg',
  'math',
  'form',
  'object',
  'embed',
  'applet',
  'base',
  'meta',
  'link',
];

const DOMPURIFY_ADD_ATTR = [
  'allowfullscreen',
  'data-asset-id',
  'data-document-id',
  'data-type',
  'data-align',
  'data-collection',
  'data-label',
  'data-variant',
  'data-title',
  'data-author',
  'data-columns',
  'data-latex',
  'data-display-mode',
  'data-lead',
  'data-background-color',
  'data-color',
  'target',
  'rel',
  'dir',
  'lang',
  'title',
  'open',
];

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
 * Sanitizes an HTML string using DOMPurify (`isomorphic-dompurify`), stripping dangerous elements
 * (`<script>`, `<style>`, `<svg>`, `<math>`, `<form>`, `<object>`, `<embed>`), inline event handlers,
 * `srcdoc`, and unsafe URI schemes while preserving Tiptap editor nodes and data attributes.
 */
export function sanitizeHtmlString(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return String(
    DOMPurify.sanitize(html, {
      ADD_TAGS: DOMPURIFY_ADD_TAGS,
      FORBID_TAGS: DOMPURIFY_FORBID_TAGS,
      ADD_ATTR: DOMPURIFY_ADD_ATTR,
      FORBID_ATTR: ['srcdoc'],
      ALLOWED_URI_REGEXP: DOMPURIFY_ALLOWED_URI_REGEXP,
    })
  );
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
 * Formats `textStyle` mark attributes into a CSS inline style string.
 */
function formatTextStyleAttr(attrs?: Record<string, unknown>): string {
  if (!attrs) return '';
  const parts: string[] = [];
  if (typeof attrs.color === 'string' && attrs.color) {
    parts.push(`color: ${attrs.color}`);
  }
  if (typeof attrs.fontFamily === 'string' && attrs.fontFamily) {
    parts.push(`font-family: ${attrs.fontFamily}`);
  }
  if (typeof attrs.fontSize === 'string' && attrs.fontSize) {
    parts.push(`font-size: ${attrs.fontSize}`);
  }
  if (typeof attrs.lineHeight === 'string' && attrs.lineHeight) {
    parts.push(`line-height: ${attrs.lineHeight}`);
  }
  return parts.join('; ');
}

/**
 * Parses an inline CSS style string from a `<span style="...">` tag into `textStyle` mark attributes.
 */
function parseTextStyleAttr(styleStr: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const decl of styleStr.split(';')) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val) continue;
    if (prop === 'color') attrs.color = val;
    else if (prop === 'font-family') attrs.fontFamily = val;
    else if (prop === 'font-size') attrs.fontSize = val;
    else if (prop === 'line-height') attrs.lineHeight = val;
  }
  return attrs;
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
        return serializeBlockToMarkdown(node);
      }

      const marks = Array.isArray(node.marks) ? node.marks : [];
      const hasCodeMark = marks.some((m) => m.type === 'code');
      let text = hasCodeMark
        ? node.text
        : node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Apply code mark innermost first, then apply remaining marks in reverse order
      // so outer-to-inner parsing reconstructs marks in their exact original sequence.
      if (hasCodeMark) {
        text = `\`${text}\``;
      }

      const nonCodeMarks = marks.filter((m) => m.type !== 'code').reverse();
      for (const mark of nonCodeMarks) {
        switch (mark.type) {
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
          case 'highlight': {
            const color = mark.attrs?.color ? escAttr(mark.attrs.color) : '';
            text = color ? `<mark data-color="${color}">${text}</mark>` : `<mark>${text}</mark>`;
            break;
          }
          case 'textStyle': {
            const styleStr = formatTextStyleAttr(mark.attrs);
            text = styleStr ? `<span style="${escAttr(styleStr)}">${text}</span>` : text;
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
 * Serializes a single ProseMirror block node into pure Markdown without metadata comments.
 */
function serializeBlockToMarkdown(node: ProseMirrorJSONNode): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `${'#'.repeat(level)} ${serializeInline(node.content)}`;
    }
    case 'leadParagraph': {
      return `> **Lead:** ${serializeInline(node.content)}`;
    }
    case 'paragraph': {
      return serializeInline(node.content);
    }
    case 'blockquote': {
      return jsonToMarkdownPure(node)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    }
    case 'informationPane': {
      const variant = String(node.attrs?.variant || 'info').toUpperCase();
      const title = String(node.attrs?.title || variant);
      const body = jsonToMarkdownPure(node)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
      return `> [!${variant}] ${title}\n${body}`;
    }
    case 'conversationHistory': {
      const author = String(node.attrs?.author || 'Comment');
      const body = jsonToMarkdownPure(node)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
      return `> **Conversation History** *(${author})*\n${body}`;
    }
    case 'details': {
      const summaryNode = node.content?.find((c) => c.type === 'detailsSummary');
      const contentNode = node.content?.find((c) => c.type === 'detailsContent');
      const summaryText = serializeInline(summaryNode?.content) || 'Details';
      const bodyText = contentNode ? jsonToMarkdownPure(contentNode) : '';
      return `<details>\n<summary>${summaryText}</summary>\n\n${bodyText}\n</details>`;
    }
    case 'codeBlock': {
      const lang = String(node.attrs?.language || '');
      const codeText = (node.content || []).map((c) => c.text || '').join('');
      return `\`\`\`${lang}\n${codeText}\n\`\`\``;
    }
    case 'bulletList': {
      const items = (node.content || []).map((item) => `- ${jsonToMarkdownPure(item).trim()}`);
      return items.join('\n');
    }
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      const items = (node.content || []).map(
        (item, idx) => `${start + idx}. ${jsonToMarkdownPure(item).trim()}`
      );
      return items.join('\n');
    }
    case 'taskList': {
      const items = (node.content || []).map((item) => {
        const checked = item.attrs?.checked ? 'x' : ' ';
        return `- [${checked}] ${jsonToMarkdownPure(item).trim()}`;
      });
      return items.join('\n');
    }
    case 'listItem':
    case 'taskItem': {
      return (node.content || []).map((c) => serializeInline(c.content)).join('\n');
    }
    case 'horizontalRule': {
      return '---';
    }
    case 'pageBreak': {
      return '<!-- pagebreak -->';
    }
    case 'tableOfContents': {
      return '<!-- toc -->';
    }
    case 'image': {
      const alt = String(node.attrs?.alt || '');
      const src = mdUrl(node.attrs?.src);
      return `![${alt}](${src})`;
    }
    case 'video': {
      const src = mdUrl(node.attrs?.src);
      const title = String(node.attrs?.title || 'Video');
      return `[Video: ${title}](${src})`;
    }
    case 'audio': {
      const src = mdUrl(node.attrs?.src);
      const title = String(node.attrs?.title || 'Audio');
      return `[Audio: ${title}](${src})`;
    }
    case 'attachment': {
      const href = mdUrl(node.attrs?.href || node.attrs?.src);
      const filename = String(node.attrs?.filename || node.attrs?.title || 'Attachment');
      return `[Attachment: ${filename}](${href})`;
    }
    case 'iframe': {
      const rawSrc = String(node.attrs?.src || '');
      const src = isSafeIframeUrl(rawSrc) ? mdUrl(rawSrc) : '#';
      const title = String(node.attrs?.title || 'Embed');
      return `[Embed: ${title}](${src})`;
    }
    case 'mathematics': {
      const latex = String(node.attrs?.latex || '');
      const isBlock =
        node.attrs?.displayMode === 'block' || node.attrs?.displayMode === true;
      return isBlock ? `$$\n${latex}\n$$` : `$${latex}$`;
    }
    case 'table': {
      const rows = node.content || [];
      const mdRows: string[] = [];
      rows.forEach((row, rIdx) => {
        const cells = (row.content || []).map((cell) =>
          jsonToMarkdownPure(cell).replace(/\n+/g, ' ').trim()
        );
        mdRows.push(`| ${cells.join(' | ')} |`);
        if (rIdx === 0) {
          mdRows.push(`| ${cells.map(() => '---').join(' | ')} |`);
        }
      });
      return mdRows.join('\n');
    }
    case 'tableCell':
    case 'tableHeader': {
      return (node.content || []).map((c) => serializeInline(c.content)).join(' ');
    }
    case 'layoutContainer': {
      const columns = String(node.attrs?.columns || '1:1');
      const cols = (node.content || []).map(
        (col) => `<div data-type="layout-column">\n\n${jsonToMarkdownPure(col)}\n\n</div>`
      );
      return `<div data-type="layout-container" data-columns="${escAttr(columns)}">\n${cols.join('\n')}\n</div>`;
    }
    case 'layoutColumn': {
      return jsonToMarkdownPure({ type: 'doc', content: node.content });
    }
    default: {
      if (Array.isArray(node.content)) {
        return serializeInline(node.content);
      }
      return '';
    }
  }
}

/**
 * Pure Markdown serializer used for nested block bodies.
 */
function jsonToMarkdownPure(doc: ProseMirrorJSONNode | null | undefined): string {
  if (!doc || typeof doc !== 'object') return '';
  const blocks = Array.isArray(doc.content) ? doc.content : [];
  return blocks
    .map((node) => serializeBlockToMarkdown(node))
    .filter((l) => l !== undefined)
    .join('\n\n');
}

/**
 * Encodes a ProseMirror node for lossless round-trip preservation when the node carries
 * rich Strapi/Edifice attributes (e.g. `data-asset-id`, `data-document-id`, `width`, `textAlign`,
 * `backgroundColor`, `colspan`, `timestamp`, etc.) that plain Markdown syntax cannot represent.
 */
function encodeNodeMetaComment(node: ProseMirrorJSONNode): string {
  const json = JSON.stringify(node).replace(/-->/g, '--\\u003e');
  return `<!-- tiptap-node:${json} -->`;
}

/**
 * Converts a ProseMirror JSON document tree into Markdown.
 * Emits clean Markdown for standard blocks and attaches a non-rendering HTML comment metadata
 * annotation only when a block contains rich attributes that plain Markdown syntax would drop.
 */
export function jsonToMarkdown(doc: ProseMirrorJSONNode | null | undefined): string {
  if (!doc || typeof doc !== 'object') return '';

  const blocks = Array.isArray(doc.content) ? doc.content : [];
  const lines: string[] = [];

  for (const node of blocks) {
    const pureMd = serializeBlockToMarkdown(node);
    const reparsed = parseSingleMarkdownBlock(pureMd);
    if (reparsed && JSON.stringify(reparsed) === JSON.stringify(node)) {
      lines.push(pureMd);
    } else {
      lines.push(
        pureMd ? `${pureMd}\n${encodeNodeMetaComment(node)}` : encodeNodeMetaComment(node)
      );
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
    /( {2,}\n|<br\s*\/?>|\$([^$\n]+)\$|!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)|\[([^\]]+)\]\((<[^>]+>|[^)]+)\)|`([^`]+)`|\*\*\*([^\n*][\s\S]*?)\*\*\*|\*\*([\s\S]+?)\*\*|~~([\s\S]+?)~~|\*([^*]+)\*|<u>([\s\S]*?)<\/u>|<sup>([\s\S]*?)<\/sup>|<sub>([\s\S]*?)<\/sub>|<abbr\s+title="([^"]*)"\s*>([\s\S]*?)<\/abbr>|<span\s+lang="([^"]*)"(?:\s+dir="([^"]*)")?\s*>([\s\S]*?)<\/span>|<span\s+style="([^"]*)"\s*>([\s\S]*?)<\/span>|<mark(?:\s+data-color="([^"]*)")?\s*>([\s\S]*?)<\/mark>)/;

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
      boldItalicInner,
      boldInner,
      strikeInner,
      italicInner,
      uInner,
      supInner,
      subInner,
      abbrTitle,
      abbrInner,
      spanLang,
      spanDir,
      spanInner,
      styleAttr,
      styleInner,
      markColor,
      markInner,
    ] = match;

    if (/^(?: {2,}\n|<br\s*\/?>)$/i.test(fullMatch)) {
      nodes.push({ type: 'hardBreak' });
    } else if (mathLatex !== undefined) {
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
    } else if (boldItalicInner !== undefined) {
      nodes.push(
        ...parseInlineMarkdown(boldItalicInner, [
          ...inheritedMarks,
          { type: 'bold' },
          { type: 'italic' },
        ])
      );
    } else if (boldInner !== undefined) {
      nodes.push(...parseInlineMarkdown(boldInner, [...inheritedMarks, { type: 'bold' }]));
    } else if (strikeInner !== undefined) {
      nodes.push(...parseInlineMarkdown(strikeInner, [...inheritedMarks, { type: 'strike' }]));
    } else if (italicInner !== undefined) {
      nodes.push(...parseInlineMarkdown(italicInner, [...inheritedMarks, { type: 'italic' }]));
    } else if (uInner !== undefined) {
      nodes.push(...parseInlineMarkdown(uInner, [...inheritedMarks, { type: 'underline' }]));
    } else if (supInner !== undefined) {
      nodes.push(...parseInlineMarkdown(supInner, [...inheritedMarks, { type: 'superscript' }]));
    } else if (subInner !== undefined) {
      nodes.push(...parseInlineMarkdown(subInner, [...inheritedMarks, { type: 'subscript' }]));
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
    } else if (styleAttr !== undefined && styleInner !== undefined) {
      const parsedStyle = parseTextStyleAttr(unescapeHtmlEntities(styleAttr));
      nodes.push(
        ...parseInlineMarkdown(styleInner, [
          ...inheritedMarks,
          { type: 'textStyle', attrs: parsedStyle },
        ])
      );
    } else if (markInner !== undefined) {
      const color = markColor ? unescapeHtmlEntities(markColor) : undefined;
      nodes.push(
        ...parseInlineMarkdown(markInner, [
          ...inheritedMarks,
          { type: 'highlight', ...(color ? { attrs: { color } } : {}) },
        ])
      );
    }

    remaining = remaining.slice(match.index + fullMatch.length);
  }

  return nodes;
}

/**
 * Splits a normalized Markdown document into top-level block chunks while keeping
 * multi-paragraph `<details>`, `<div data-type="layout-container">`, fenced code blocks,
 * and display math blocks intact across blank lines.
 */
function splitMarkdownBlocks(normalized: string): string[] {
  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let inMath = false;
  let detailsDepth = 0;
  let layoutDivDepth = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```')) {
      inFence = !inFence;
    } else if (!inFence && trimmedLine === '$$') {
      inMath = !inMath;
    } else if (!inFence && !inMath) {
      const detailsOpens = (line.match(/<details\b[^>]*>/gi) || []).length;
      const detailsCloses = (line.match(/<\/details\s*>/gi) || []).length;
      detailsDepth = Math.max(0, detailsDepth + detailsOpens - detailsCloses);

      if (layoutDivDepth > 0 || /<div\s+data-type="layout-container"/i.test(line)) {
        const divOpens = (line.match(/<div\b[^>]*>/gi) || []).length;
        const divCloses = (line.match(/<\/div\s*>/gi) || []).length;
        layoutDivDepth = Math.max(0, layoutDivDepth + divOpens - divCloses);
      }
    }

    const insideContainer = inFence || inMath || detailsDepth > 0 || layoutDivDepth > 0;
    if (!insideContainer && trimmedLine === '') {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
}

/**
 * Parses a single pure Markdown block (without metadata comments) into a ProseMirror JSON node.
 */
function parseSingleMarkdownBlock(rawBlock: string): ProseMirrorJSONNode | null {
  const trimmed = rawBlock.trim();
  if (!trimmed) return null;

  // Fenced code block
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    const language = firstNewline > 3 ? trimmed.slice(3, firstNewline).trim() : null;
    const rawCode = firstNewline > -1 ? trimmed.slice(firstNewline + 1, -3) : '';
    const code = rawCode.replace(/\n$/, '');
    return {
      type: 'codeBlock',
      attrs: { language },
      content: code ? [{ type: 'text', text: code }] : [],
    };
  }

  // Display math block $$ ... $$
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
    const latex = trimmed.slice(2, -2).trim();
    return {
      type: 'mathematics',
      attrs: { latex, displayMode: 'block' },
    };
  }

  // Multi-column layout container
  const layoutMatch =
    /^<div\s+data-type="layout-container"(?:\s+data-columns="([^"]*)")?\s*>([\s\S]*?)<\/div>$/i.exec(
      trimmed
    );
  if (layoutMatch) {
    const columns = unescapeHtmlEntities(layoutMatch[1] || '1:1');
    const inner = layoutMatch[2];
    const colRegex = /<div\s+data-type="layout-column"\s*>([\s\S]*?)<\/div>/gi;
    const colNodes: ProseMirrorJSONNode[] = [];
    let colMatch: RegExpExecArray | null;
    while ((colMatch = colRegex.exec(inner)) !== null) {
      const colDoc = markdownToJson(colMatch[1].trim());
      colNodes.push({
        type: 'layoutColumn',
        content:
          colDoc.content && colDoc.content.length > 0 ? colDoc.content : [{ type: 'paragraph' }],
      });
    }
    if (colNodes.length > 0) {
      return {
        type: 'layoutContainer',
        attrs: { columns },
        content: colNodes,
      };
    }
  }

  // Collapsible <details> block
  const detailsMatch =
    /^<details>\s*<summary>([\s\S]*?)<\/summary>\s*([\s\S]*?)\s*<\/details>$/i.exec(trimmed);
  if (detailsMatch) {
    const summaryInline = parseInlineMarkdown(detailsMatch[1].trim());
    const bodyDoc = markdownToJson(detailsMatch[2].trim());
    return {
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
    };
  }

  // Page break
  if (/^<!--\s*pagebreak\s*-->$/i.test(trimmed)) {
    return { type: 'pageBreak' };
  }

  // Table of contents
  if (/^<!--\s*toc\s*-->$/i.test(trimmed)) {
    return { type: 'tableOfContents', attrs: { headings: [] } };
  }

  // Horizontal rule
  if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
    return { type: 'horizontalRule' };
  }

  // Heading
  const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
  if (headingMatch) {
    const inlineNodes = parseInlineMarkdown(headingMatch[2]);
    return {
      type: 'heading',
      attrs: { level: headingMatch[1].length },
      content: inlineNodes,
    };
  }

  // Standalone media / embed lines
  const videoMatch = /^\[Video:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
  if (videoMatch) {
    return {
      type: 'video',
      attrs: {
        title: unescapeHtmlEntities(videoMatch[1].trim() || 'Video'),
        src: parseMdUrl(videoMatch[2]),
      },
    };
  }

  const audioMatch = /^\[Audio:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
  if (audioMatch) {
    return {
      type: 'audio',
      attrs: {
        title: unescapeHtmlEntities(audioMatch[1].trim() || 'Audio'),
        src: parseMdUrl(audioMatch[2]),
      },
    };
  }

  const attachmentMatch = /^\[Attachment:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
  if (attachmentMatch) {
    const href = parseMdUrl(attachmentMatch[2]);
    const filename = unescapeHtmlEntities(attachmentMatch[1].trim() || 'Attachment');
    return {
      type: 'attachment',
      attrs: { href, src: href, filename, title: filename },
    };
  }

  const embedMatch = /^\[Embed:\s*([^\]]*)\]\((<[^>]+>|[^)]+)\)$/i.exec(trimmed);
  if (embedMatch) {
    const rawUrl = embedMatch[2].trim();
    const unwrapped =
      rawUrl.startsWith('<') && rawUrl.endsWith('>') ? rawUrl.slice(1, -1).trim() : rawUrl;
    return {
      type: 'iframe',
      attrs: {
        title: unescapeHtmlEntities(embedMatch[1].trim() || 'Embed'),
        src: isSafeIframeUrl(unwrapped) ? unwrapped : '',
      },
    };
  }

  const standaloneImgMatch = /^!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)$/.exec(trimmed);
  if (standaloneImgMatch) {
    return {
      type: 'image',
      attrs: {
        alt: unescapeHtmlEntities(standaloneImgMatch[1]),
        src: parseMdUrl(standaloneImgMatch[2]),
      },
    };
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
    return { type: 'table', content: tableRows };
  }

  // Task list
  if (lines.every((l) => /^-\s+\[([ xX])\]\s+/.test(l))) {
    return {
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
    };
  }

  // Bullet list
  if (lines.every((l) => /^[-*]\s+/.test(l))) {
    return {
      type: 'bulletList',
      content: lines.map((l) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(l.replace(/^[-*]\s+/, '')) }],
      })),
    };
  }

  // Ordered list
  if (lines.every((l) => /^\d+\.\s+/.test(l))) {
    const firstMatch = /^(\d+)\.\s+/.exec(lines[0]);
    const start = firstMatch ? Number(firstMatch[1]) || 1 : 1;
    return {
      type: 'orderedList',
      attrs: { start },
      content: lines.map((l) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(l.replace(/^\d+\.\s+/, '')) }],
      })),
    };
  }

  // Blockquote / Lead / InformationPane / ConversationHistory
  if (lines.every((l) => /^>\s?/.test(l))) {
    const strippedLines = lines.map((l) => l.replace(/^>\s?/, ''));
    const firstLine = strippedLines[0] || '';

    const leadMatch = /^\*\*Lead:\*\*\s*(.+)$/i.exec(firstLine);
    if (leadMatch && strippedLines.length === 1) {
      return {
        type: 'leadParagraph',
        content: parseInlineMarkdown(leadMatch[1]),
      };
    }

    const infoMatch = /^\[!(INFO|SUCCESS|WARNING|DANGER)\]\s*(.*)$/i.exec(firstLine);
    if (infoMatch) {
      const variant = infoMatch[1].toLowerCase();
      const title = infoMatch[2].trim() || infoMatch[1];
      const bodyText = strippedLines.slice(1).join('\n').trim();
      return {
        type: 'informationPane',
        attrs: { variant, title },
        content: [
          {
            type: 'paragraph',
            content: bodyText ? parseInlineMarkdown(bodyText) : [],
          },
        ],
      };
    }

    const convMatch = /^\*\*Conversation History\*\*\s*\*\(([^)]*)\)\*$/i.exec(firstLine);
    if (convMatch) {
      const author = convMatch[1].trim() || 'Comment';
      const bodyText = strippedLines.slice(1).join('\n').trim();
      return {
        type: 'conversationHistory',
        attrs: { author },
        content: [
          {
            type: 'paragraph',
            content: bodyText ? parseInlineMarkdown(bodyText) : [],
          },
        ],
      };
    }

    return {
      type: 'blockquote',
      content: strippedLines.map((line) => ({
        type: 'paragraph',
        content: parseInlineMarkdown(line),
      })),
    };
  }

  // Standard paragraph
  return {
    type: 'paragraph',
    content: parseInlineMarkdown(trimmed),
  };
}

/**
 * Sanitizes URL attributes inside a restored ProseMirror JSON node tree so metadata comments
 * cannot bypass URL validation.
 */
function sanitizeRestoredNodeTree(node: ProseMirrorJSONNode): ProseMirrorJSONNode {
  const copy: ProseMirrorJSONNode = { ...node };
  if (copy.attrs && typeof copy.attrs === 'object') {
    const attrs = { ...copy.attrs };
    if (typeof attrs.src === 'string') {
      if (copy.type === 'iframe') {
        attrs.src = isSafeIframeUrl(attrs.src) ? attrs.src : '';
      } else {
        attrs.src = isSafeUrl(attrs.src) ? attrs.src : '#';
      }
    }
    if (typeof attrs.href === 'string') {
      attrs.href = isSafeUrl(attrs.href) ? attrs.href : '#';
    }
    copy.attrs = attrs;
  }
  if (Array.isArray(copy.marks)) {
    copy.marks = copy.marks.map((m) => {
      if (m.attrs && typeof m.attrs.href === 'string') {
        return {
          ...m,
          attrs: {
            ...m.attrs,
            href: isSafeUrl(m.attrs.href) ? m.attrs.href : '#',
          },
        };
      }
      return m;
    });
  }
  if (Array.isArray(copy.content)) {
    copy.content = copy.content.map(sanitizeRestoredNodeTree);
  }
  return copy;
}

/**
 * Parses a Markdown string into a ProseMirror JSON document tree with full fidelity for
 * inline formatting, lists, tables, custom blocks, and rich node attributes.
 */
export function markdownToJson(markdown: string): ProseMirrorJSONNode {
  if (!markdown || typeof markdown !== 'string') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const normalized = markdown.replace(/\r\n/g, '\n');
  const blocks = splitMarkdownBlocks(normalized);
  const content: ProseMirrorJSONNode[] = [];

  for (const rawBlock of blocks) {
    const trimmed = rawBlock.trim();
    if (!trimmed) continue;

    // Check for optional lossless metadata comment at the end of the block
    const metaMatch = /^(?:([\s\S]*?)\n)?<!--\s*tiptap-node:([\s\S]+?)\s*-->$/.exec(trimmed);
    if (metaMatch) {
      const mdPart = (metaMatch[1] ?? '').trim();
      const rawJson = metaMatch[2].replace(/--\\u003e/g, '-->');
      try {
        const storedNode = sanitizeRestoredNodeTree(JSON.parse(rawJson) as ProseMirrorJSONNode);
        const expectedMd = serializeBlockToMarkdown(storedNode).trim();
        if (!mdPart || mdPart === expectedMd) {
          content.push(storedNode);
          continue;
        }
        // If the user edited the visible Markdown text, parse the updated Markdown
        // and preserve the block's rich attributes (e.g. id, tag, textAlign, data-asset-id)
        const parsedEdited = parseSingleMarkdownBlock(mdPart);
        if (parsedEdited) {
          if (storedNode.attrs || parsedEdited.attrs) {
            parsedEdited.attrs = { ...(storedNode.attrs || {}), ...(parsedEdited.attrs || {}) };
          }
          content.push(parsedEdited);
          continue;
        }
      } catch {
        // Fall through to normal Markdown parsing if metadata comment is malformed
      }
      if (mdPart) {
        const fallbackNode = parseSingleMarkdownBlock(mdPart);
        if (fallbackNode) content.push(fallbackNode);
      }
      continue;
    }

    const parsedBlock = parseSingleMarkdownBlock(trimmed);
    if (parsedBlock) {
      content.push(parsedBlock);
    }
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
