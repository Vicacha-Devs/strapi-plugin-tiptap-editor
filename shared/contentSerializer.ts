import type { TiptapOutputFormat } from './types';
import {
  type ProseMirrorJSONNode,
  isSafeIframeUrl,
  isSafeUrl,
  sanitizeHtmlString,
} from './serializers/sanitizers';
import { parseInlineMarkdown } from './serializers/inlineMarkdownParser';
import {
  encodeNodeMetaComment,
  serializeBlockToMarkdown,
} from './serializers/markdownSerializer';
import {
  markdownToJson,
  parseSingleMarkdownBlock,
  splitMarkdownBlocks,
} from './serializers/markdownParser';

export {
  type ProseMirrorJSONNode,
  isSafeUrl,
  isSafeIframeUrl,
  sanitizeHtmlString,
  parseInlineMarkdown,
  markdownToJson,
};

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
    // A block "opens a container" only if it leaves a fence/math/details/layout unclosed
    const opensContainer =
      pureMd.length > 0 && splitMarkdownBlocks(`${pureMd}\n\n__sentinel__`).length !== 2;
    if (opensContainer) {
      lines.push(encodeNodeMetaComment(node));
      continue;
    }
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

export interface TiptapDocumentStats {
  words: number;
  characters: number;
  readingTimeMinutes: number;
  readingTime: string;
  wordsPerMinute: number;
}

export interface SerializeEditorOptions {
  wordsPerMinute?: number;
}

function collectNodeText(node: ProseMirrorJSONNode | null | undefined, parts: string[]): void {
  if (!node || typeof node !== 'object') return;

  if (typeof node.text === 'string') {
    parts.push(node.text);
    return;
  }

  if (node.type === 'hardBreak') {
    parts.push('\n');
    return;
  }

  if (node.type === 'linker' && typeof node.attrs?.label === 'string') {
    parts.push(node.attrs.label);
    return;
  }

  if (node.type === 'mathematics' && typeof node.attrs?.latex === 'string') {
    parts.push(node.attrs.latex);
    return;
  }

  if (Array.isArray(node.content)) {
    const isBlockContainer =
      node.type === 'doc' ||
      node.type === 'blockquote' ||
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'taskList' ||
      node.type === 'listItem' ||
      node.type === 'taskItem' ||
      node.type === 'table' ||
      node.type === 'tableRow' ||
      node.type === 'tableCell' ||
      node.type === 'tableHeader' ||
      node.type === 'details' ||
      node.type === 'detailsContent' ||
      node.type === 'informationPane' ||
      node.type === 'conversationHistory' ||
      node.type === 'layoutContainer' ||
      node.type === 'layoutColumn';

    if (isBlockContainer) {
      const childStrings: string[] = [];
      for (const child of node.content) {
        const subParts: string[] = [];
        collectNodeText(child, subParts);
        const joined = subParts.join('');
        if (joined) childStrings.push(joined);
      }
      if (childStrings.length > 0) {
        parts.push(childStrings.join('\n'));
      }
    } else {
      for (const child of node.content) {
        collectNodeText(child, parts);
      }
    }
  }
}

/**
 * Extracts plain text from a ProseMirror JSON document tree.
 */
export function extractTextFromJsonNode(doc: ProseMirrorJSONNode | null | undefined): string {
  const parts: string[] = [];
  collectNodeText(doc, parts);
  return parts.join('');
}

/**
 * Computes word count, character count, and estimated reading time for a document or editor instance.
 */
export function computeDocumentStats(
  doc: ProseMirrorJSONNode | null | undefined,
  options?: {
    wordsPerMinute?: number;
    characters?: number;
    words?: number;
  }
): TiptapDocumentStats {
  const safeWpm =
    typeof options?.wordsPerMinute === 'number' &&
    Number.isFinite(options.wordsPerMinute) &&
    options.wordsPerMinute > 0
      ? options.wordsPerMinute
      : 200;

  const text = extractTextFromJsonNode(doc);
  const characters =
    typeof options?.characters === 'number' && Number.isFinite(options.characters)
      ? options.characters
      : text.length;
  const words =
    typeof options?.words === 'number' && Number.isFinite(options.words)
      ? options.words
      : text.trim()
        ? text.trim().split(/\s+/).length
        : 0;
  const readingTimeMinutes = words > 0 ? Math.max(1, Math.ceil(words / safeWpm)) : 0;

  return {
    words,
    characters,
    readingTimeMinutes,
    readingTime: `${readingTimeMinutes} min read`,
    wordsPerMinute: safeWpm,
  };
}

/**
 * Builds the exported ProseMirror JSON document enriched with `words`, `characters`,
 * `readingTimeMinutes`, `readingTime`, and `stats`.
 */
export function buildExportedJsonDocument(
  editor: {
    getJSON: () => unknown;
    storage?: unknown;
    state?: { doc?: { textContent?: string } };
  },
  options?: SerializeEditorOptions
): Record<string, unknown> {
  const rawJson = editor.getJSON();
  const baseDoc: Record<string, unknown> =
    rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)
      ? { ...(rawJson as Record<string, unknown>) }
      : { type: 'doc', content: [] };

  const storage = editor.storage as
    | {
        characterCount?: { characters?: () => number; words?: () => number };
      }
    | undefined;

  const storageCharacters =
    typeof storage?.characterCount?.characters === 'function'
      ? storage.characterCount.characters()
      : undefined;
  const storageWords =
    typeof storage?.characterCount?.words === 'function'
      ? storage.characterCount.words()
      : undefined;

  const stats = computeDocumentStats(baseDoc as ProseMirrorJSONNode, {
    wordsPerMinute: options?.wordsPerMinute,
    characters: storageCharacters,
    words: storageWords,
  });

  return {
    ...baseDoc,
    words: stats.words,
    characters: stats.characters,
    readingTimeMinutes: stats.readingTimeMinutes,
    readingTime: stats.readingTime,
    stats,
  };
}

/**
 * Serializes a Tiptap editor instance into the configured output format (`json`, `html`, or `markdown`).
 * When `outputFormat === 'json'`, exports `words`, `characters`, `readingTimeMinutes`, `readingTime`, and `stats`.
 */
export function serializeEditorContent(
  editor: {
    getJSON: () => unknown;
    getHTML: () => string;
    storage?: unknown;
    state?: { doc?: { textContent?: string } };
  },
  outputFormat: TiptapOutputFormat = 'json',
  options?: SerializeEditorOptions
): string {
  switch (outputFormat) {
    case 'html':
      return sanitizeHtmlString(editor.getHTML());
    case 'markdown':
      return jsonToMarkdown(editor.getJSON() as ProseMirrorJSONNode);
    case 'json':
    default:
      return JSON.stringify(buildExportedJsonDocument(editor, options));
  }
}
