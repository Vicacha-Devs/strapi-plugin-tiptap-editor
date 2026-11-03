import {
  type ProseMirrorJSONNode,
  type SanitizeOptions,
  escAttr,
  formatTextStyleAttr,
  isSafeIframeUrl,
  mdUrl,
  toSafeCellBackgroundColor,
} from './sanitizers';

const INLINE_NODE_TYPES = new Set(['text', 'hardBreak', 'linker', 'mathematics']);

function escapeMdBracketLabel(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/[\r\n]+/g, ' ');
}

function formatMdTitleSuffix(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  if (!cleaned) return '';
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return ` "${escaped}"`;
}

/**
 * Serializes inline ProseMirror nodes and marks to Markdown.
 */
export function serializeInline(
  nodes?: ProseMirrorJSONNode[],
  options?: SanitizeOptions
): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>';
      if (node.type === 'linker') {
        const label = escapeMdBracketLabel(node.attrs?.label || node.attrs?.documentId || 'Link');
        const collection = String(node.attrs?.collectionName || 'document');
        const docId = String(node.attrs?.documentId || '');
        const rawHref = String(node.attrs?.href || `strapi://${collection}/${docId}`);
        return `[${label}](${mdUrl(rawHref)})`;
      }
      if (node.type === 'mathematics') {
        const latex = String(node.attrs?.latex || '');
        const isBlock =
          node.attrs?.displayMode === 'block' || node.attrs?.displayMode === true;
        return isBlock ? `$$\n${latex}\n$$` : `$${latex}$`;
      }
      if (node.type !== 'text' || typeof node.text !== 'string') {
        return serializeBlockToMarkdown(node, options);
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
            const escapedLabel = text.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
            const titleSuffix = formatMdTitleSuffix(mark.attrs?.title);
            text = `[${escapedLabel}](${href}${titleSuffix})`;
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
            const safeColor = mark.attrs?.color ? toSafeCellBackgroundColor(mark.attrs.color) : null;
            text = safeColor
              ? `<mark data-color="${escAttr(safeColor)}">${text}</mark>`
              : `<mark>${text}</mark>`;
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
export function serializeBlockToMarkdown(
  node: ProseMirrorJSONNode,
  options?: SanitizeOptions
): string {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `${'#'.repeat(level)} ${serializeInline(node.content, options)}`;
    }
    case 'leadParagraph': {
      return `> **Lead:** ${serializeInline(node.content, options)}`;
    }
    case 'paragraph': {
      return serializeInline(node.content, options);
    }
    case 'blockquote': {
      return jsonToMarkdownPure(node, options)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
    }
    case 'informationPane': {
      const variant = String(node.attrs?.variant || 'info')
        .replace(/[\r\n\]]/g, '')
        .toUpperCase();
      const title = String(node.attrs?.title || variant).replace(/[\r\n]/g, '');
      const body = jsonToMarkdownPure(node, options)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
      return `> [!${variant}] ${title}\n${body}`;
    }
    case 'conversationHistory': {
      const author = String(node.attrs?.author || 'Comment').replace(/[\r\n]/g, '');
      const rawTimestamp =
        typeof node.attrs?.timestamp === 'string'
          ? node.attrs.timestamp.replace(/[\r\n]/g, '').trim()
          : '';
      const tsSuffix = rawTimestamp ? ` [${escapeMdBracketLabel(rawTimestamp)}]` : '';
      const body = jsonToMarkdownPure(node, options)
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n');
      return `> **Conversation History** *(${author})*${tsSuffix}\n${body}`;
    }
    case 'details': {
      const summaryNode = node.content?.find((c) => c.type === 'detailsSummary');
      const contentNode = node.content?.find((c) => c.type === 'detailsContent');
      const summaryText = serializeInline(summaryNode?.content, options) || 'Details';
      const bodyText = contentNode ? jsonToMarkdownPure(contentNode, options) : '';
      return `<details>\n<summary>${summaryText}</summary>\n\n${bodyText}\n</details>`;
    }
    case 'codeBlock': {
      const lang = String(node.attrs?.language || '').replace(/[`~\r\n]/g, '');
      const codeText = (node.content || []).map((c) => c.text || '').join('');
      const longestRun = Math.max(2, ...(codeText.match(/`+/g) ?? []).map((r) => r.length));
      const fence = '`'.repeat(longestRun + 1);
      return `${fence}${lang}\n${codeText}\n${fence}`;
    }
    case 'bulletList': {
      const items = (node.content || []).map(
        (item) => `- ${jsonToMarkdownPure(item, options).trim()}`
      );
      return items.join('\n');
    }
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      const items = (node.content || []).map(
        (item, idx) => `${start + idx}. ${jsonToMarkdownPure(item, options).trim()}`
      );
      return items.join('\n');
    }
    case 'taskList': {
      const items = (node.content || []).map((item) => {
        const checked = item.attrs?.checked ? 'x' : ' ';
        return `- [${checked}] ${jsonToMarkdownPure(item, options).trim()}`;
      });
      return items.join('\n');
    }
    case 'listItem':
    case 'taskItem': {
      return (node.content || []).map((c) => serializeInline(c.content, options)).join('\n');
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
      const alt = escapeMdBracketLabel(node.attrs?.alt || '');
      const src = mdUrl(node.attrs?.src);
      const titleSuffix = formatMdTitleSuffix(node.attrs?.title);
      return `![${alt}](${src}${titleSuffix})`;
    }
    case 'video': {
      const src = mdUrl(node.attrs?.src);
      const title = escapeMdBracketLabel(node.attrs?.title || 'Video');
      return `[Video: ${title}](${src})`;
    }
    case 'audio': {
      const src = mdUrl(node.attrs?.src);
      const title = escapeMdBracketLabel(node.attrs?.title || 'Audio');
      return `[Audio: ${title}](${src})`;
    }
    case 'attachment': {
      const href = mdUrl(node.attrs?.href || node.attrs?.src);
      const filename = escapeMdBracketLabel(
        node.attrs?.filename || node.attrs?.title || 'Attachment'
      );
      return `[Attachment: ${filename}](${href})`;
    }
    case 'iframe': {
      const rawSrc = String(node.attrs?.src || '');
      const src = isSafeIframeUrl(rawSrc, options?.allowedIframeDomains) ? mdUrl(rawSrc) : '#';
      const title = escapeMdBracketLabel(node.attrs?.title || 'Embed');
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
          jsonToMarkdownPure(cell, options)
            .replace(/\n+/g, ' ')
            .replace(/\|/g, '\\|')
            .trim()
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
      return (node.content || []).map((c) => serializeInline(c.content, options)).join(' ');
    }
    case 'layoutContainer': {
      const columns = String(node.attrs?.columns || '1:1');
      const cols = (node.content || []).map(
        (col) => `<div data-type="layout-column">\n\n${jsonToMarkdownPure(col, options)}\n\n</div>`
      );
      return `<div data-type="layout-container" data-columns="${escAttr(columns)}">\n${cols.join('\n')}\n</div>`;
    }
    case 'layoutColumn': {
      return jsonToMarkdownPure({ type: 'doc', content: node.content }, options);
    }
    default: {
      if (Array.isArray(node.content) && node.content.length > 0) {
        const isInlineContent = node.content.every(
          (child) => typeof child.type === 'string' && INLINE_NODE_TYPES.has(child.type)
        );
        return isInlineContent
          ? serializeInline(node.content, options)
          : jsonToMarkdownPure(node, options);
      }
      return '';
    }
  }
}

/**
 * Pure Markdown serializer used for nested block bodies.
 */
export function jsonToMarkdownPure(
  doc: ProseMirrorJSONNode | null | undefined,
  options?: SanitizeOptions
): string {
  if (!doc || typeof doc !== 'object') return '';
  const blocks = Array.isArray(doc.content) ? doc.content : [];
  return blocks
    .map((node) => serializeBlockToMarkdown(node, options))
    .filter((l) => l !== undefined)
    .join('\n\n');
}

/**
 * Encodes a ProseMirror node for lossless round-trip preservation when the node carries
 * rich Strapi/Edifice attributes (e.g. `data-asset-id`, `data-document-id`, `width`, `textAlign`,
 * `backgroundColor`, `colspan`, `timestamp`, etc.) that plain Markdown syntax cannot represent.
 */
export function encodeNodeMetaComment(node: ProseMirrorJSONNode): string {
  const json = JSON.stringify(node)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/--/g, '\\u002d\\u002d');
  return `<!-- tiptap-node:${json} -->`;
}
