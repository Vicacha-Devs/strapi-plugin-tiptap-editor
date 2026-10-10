// shared/contentSerializer.ts
import type { TiptapOutputFormat } from './types';

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:', 'strapi:']);

/**
 * Validates that a URL uses a safe protocol (http, https, mailto, tel, strapi://)
 * or is a safe relative path (/ or #). Blocks javascript:, vbscript:, data:, etc.
 */
export function isSafeUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Reject control characters or whitespace-obfuscated schemes
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]+/g, '');
  if (/^(javascript|vbscript|data|file|blob):/i.test(normalized)) {
    return false;
  }

  // Allow relative URLs and anchor hashes
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return !trimmed.startsWith('//');
  }

  // Allow strapi:// internal links
  if (/^strapi:\/\/[a-zA-Z0-9_.:-]+\/[a-zA-Z0-9_-]+/.test(trimmed)) {
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
 * Validates that an iframe embed URL uses HTTPS and optionally matches an allowed domain list.
 */
export function isSafeIframeUrl(
  rawUrl: string | null | undefined,
  allowedDomains?: string[]
): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) return false;

    if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
      return allowedDomains.some((domain) => {
        const clean = domain.trim().toLowerCase();
        if (!clean) return false;
        return hostname === clean || hostname.endsWith(`.${clean}`);
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes HTML strings to remove executable scripts, event handlers, and unsafe URLs.
 */
export function sanitizeHtmlString(html: string): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<(object|embed|applet|base|meta|link)\b[^>]*>([\s\S]*?<\/\1>)?/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*')/gi, '$1="#"');
}

interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface PMNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: PMMark[];
  content?: PMNode[];
}

function serializeInlineMarks(text: string, marks?: PMMark[]): string {
  if (!marks || marks.length === 0) return text;
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'superscript':
        result = `<sup>${result}</sup>`;
        break;
      case 'subscript':
        result = `<sub>${result}</sub>`;
        break;
      case 'abbr': {
        const title = String(mark.attrs?.title ?? '').replace(/"/g, '&quot;');
        result = `<abbr title="${title}">${result}</abbr>`;
        break;
      }
      case 'language': {
        const lang = String(mark.attrs?.lang ?? '').replace(/"/g, '&quot;');
        const dir = mark.attrs?.dir ? ` dir="${String(mark.attrs.dir).replace(/"/g, '&quot;')}"` : '';
        result = `<span lang="${lang}"${dir}>${result}</span>`;
        break;
      }
      case 'link': {
        const href = String(mark.attrs?.href ?? '');
        result = `[${result}](${href})`;
        break;
      }
      default:
        break;
    }
  }
  return result;
}

function serializeInlineContent(nodes?: PMNode[]): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        return serializeInlineMarks(node.text ?? '', node.marks);
      }
      if (node.type === 'hardBreak') {
        return '  \n';
      }
      if (node.type === 'linker') {
        const label = String(node.attrs?.label || node.attrs?.documentId || 'Link');
        const col = String(node.attrs?.collectionName || 'content');
        const docId = String(node.attrs?.documentId || '');
        const href = String(node.attrs?.href || `strapi://${col}/${docId}`);
        return `[${label}](${href})`;
      }
      if (node.type === 'mathematics') {
        const latex = String(node.attrs?.latex ?? '');
        return node.attrs?.displayMode === 'block' ? `$$\n${latex}\n$$` : `$${latex}$`;
      }
      return serializeNodeToMarkdown(node);
    })
    .join('');
}

function serializeNodeToMarkdown(node: PMNode): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(serializeNodeToMarkdown).filter(Boolean).join('\n\n');
    case 'paragraph':
      return serializeInlineContent(node.content);
    case 'leadParagraph':
      return `> **Lead:** ${serializeInlineContent(node.content)}`;
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      return `${'#'.repeat(level)} ${serializeInlineContent(node.content)}`;
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map(serializeNodeToMarkdown).join('\n');
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => `- ${(item.content ?? []).map(serializeNodeToMarkdown).join('\n  ')}`)
        .join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      return (node.content ?? [])
        .map(
          (item, idx) =>
            `${start + idx}. ${(item.content ?? []).map(serializeNodeToMarkdown).join('\n   ')}`
        )
        .join('\n');
    }
    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.checked ? 'x' : ' ';
          return `- [${checked}] ${(item.content ?? []).map(serializeNodeToMarkdown).join(' ')}`;
        })
        .join('\n');
    case 'codeBlock': {
      const lang = String(node.attrs?.language ?? '');
      const code = serializeInlineContent(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'horizontalRule':
      return '---';
    case 'pageBreak':
      return '<!-- pagebreak -->';
    case 'image': {
      const alt = String(node.attrs?.alt ?? '');
      const src = String(node.attrs?.src ?? '');
      return `![${alt}](${src})`;
    }
    case 'video': {
      const title = String(node.attrs?.title || 'Video');
      const src = String(node.attrs?.src ?? '');
      return `[Video: ${title}](${src})`;
    }
    case 'audio': {
      const title = String(node.attrs?.title || 'Audio');
      const src = String(node.attrs?.src ?? '');
      return `[Audio: ${title}](${src})`;
    }
    case 'attachment': {
      const name = String(node.attrs?.filename || node.attrs?.title || 'Attachment');
      const href = String(node.attrs?.href || node.attrs?.src || '');
      return `[Attachment: ${name}](${href})`;
    }
    case 'iframe': {
      const title = String(node.attrs?.title || 'Embed');
      const src = String(node.attrs?.src ?? '');
      return `[Embed: ${title}](${src})`;
    }
    case 'informationPane': {
      const variant = String(node.attrs?.variant || 'info').toUpperCase();
      const body = (node.content ?? []).map(serializeNodeToMarkdown).join('\n');
      return `> [!${variant}]\n${body
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}`;
    }
    case 'details': {
      const summaryNode = (node.content ?? []).find((c) => c.type === 'detailsSummary');
      const contentNodes = (node.content ?? []).filter((c) => c.type !== 'detailsSummary');
      const summaryText = summaryNode ? serializeInlineContent(summaryNode.content) : 'Details';
      const bodyText = contentNodes.map(serializeNodeToMarkdown).join('\n\n');
      return `<details>\n<summary>${summaryText}</summary>\n\n${bodyText}\n</details>`;
    }
    case 'detailsContent':
      return (node.content ?? []).map(serializeNodeToMarkdown).join('\n\n');
    case 'conversationHistory': {
      const body = (node.content ?? []).map(serializeNodeToMarkdown).join('\n\n');
      return `> **Conversation History**\n${body
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}`;
    }
    case 'layoutContainer':
      return (node.content ?? []).map(serializeNodeToMarkdown).join('\n\n');
    case 'layoutColumn':
      return (node.content ?? []).map(serializeNodeToMarkdown).join('\n\n');
    case 'mathematics': {
      const latex = String(node.attrs?.latex ?? '');
      return node.attrs?.displayMode === 'block' ? `$$\n${latex}\n$$` : `$${latex}$`;
    }
    case 'table': {
      const rows = node.content ?? [];
      if (rows.length === 0) return '';
      const matrix = rows.map((row) =>
        (row.content ?? []).map((cell) =>
          (cell.content ?? []).map(serializeNodeToMarkdown).join(' ').replace(/\|/g, '\\|')
        )
      );
      const header = `| ${matrix[0].join(' | ')} |`;
      const divider = `| ${matrix[0].map(() => '---').join(' | ')} |`;
      const body = matrix
        .slice(1)
        .map((r) => `| ${r.join(' | ')} |`)
        .join('\n');
      return body ? `${header}\n${divider}\n${body}` : `${header}\n${divider}`;
    }
    default:
      if (Array.isArray(node.content)) {
        return node.content.map(serializeNodeToMarkdown).join('\n');
      }
      return node.text ?? '';
  }
}

export function jsonToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  return serializeNodeToMarkdown(doc as PMNode);
}

/**
 * Converts basic Markdown into ProseMirror JSON document structure.
 */
export function markdownToJson(markdown: string): Record<string, unknown> {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
    };
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const content: PMNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: codeLines.length > 0 ? [{ type: 'text', text: codeLines.join('\n') }] : [],
      });
      continue;
    }

    // Horizontal rule
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      content.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      content.push({
        type: 'heading',
        attrs: { level, tag: `h${level}` },
        content: [{ type: 'text', text: headingMatch[2] }],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      content.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: line.slice(2) }],
          },
        ],
      });
      i++;
      continue;
    }

    // Task list item
    const taskMatch = /^-\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (taskMatch) {
      const items: PMNode[] = [];
      while (i < lines.length) {
        const m = /^-\s+\[([ xX])\]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push({
          type: 'taskItem',
          attrs: { checked: m[1].toLowerCase() === 'x' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: m[2] }] }],
        });
        i++;
      }
      content.push({ type: 'taskList', content: items });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: PMNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: lines[i].replace(/^[-*]\s+/, '') }],
            },
          ],
        });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    // Paragraph fallback
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    });
    i++;
  }

  return {
    type: 'doc',
    content:
      content.length > 0
        ? content
        : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
  };
}

export function serializeEditorContent(
  editor: { getJSON: () => unknown; getHTML: () => string },
  format: TiptapOutputFormat = 'json'
): string {
  if (format === 'html') {
    return sanitizeHtmlString(editor.getHTML());
  }
  if (format === 'markdown') {
    return jsonToMarkdown(editor.getJSON());
  }
  return JSON.stringify(editor.getJSON());
}
