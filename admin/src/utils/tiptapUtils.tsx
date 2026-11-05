import { useEffect, useMemo, useRef, useState } from 'react';
import { Extensions, JSONContent, getSchema } from '@tiptap/core';
import { useEditor } from '@tiptap/react';
import { type InputProps, useField } from '@strapi/strapi/admin';
import { stripUnknownContent, type SanitizeSchema } from '../../../shared/src/sanitize';
import type { TiptapOutputFormat } from '../../../shared/src/types';
import {
  markdownToJson,
  sanitizeHtmlString,
  serializeEditorContent,
} from '../../../shared/src/contentSerializer';

export type { FieldValue } from '@strapi/strapi/admin';

export type TiptapInputProps = InputProps & {
  labelAction?: React.ReactNode;
};

export type RemovedContent = {
  nodeTypes: string[];
  markTypes: string[];
};

export interface UseTiptapEditorOptions {
  outputFormat?: TiptapOutputFormat;
  wordsPerMinute?: number;
  onDocUpdate?: (json: JSONContent) => void;
  disabled?: boolean;
}

const LEGACY_HTML_IN_MARKDOWN_RE =
  /^<(?:p|h[1-6]|ul|ol|blockquote|pre|table|figure|hr|article|section|div(?![^>]*data-type="layout-container"))\b/i;
const MARKDOWN_META_COMMENT_RE = /<!--\s*(?:tiptap-node:|pagebreak|toc)/i;

const isProseMirrorDocObject = (val: unknown): val is JSONContent =>
  Boolean(val) &&
  typeof val === 'object' &&
  !Array.isArray(val) &&
  (val as { type?: unknown }).type === 'doc';

const MALFORMED_FALLBACK_SYMBOL = Symbol('tiptapMalformedContent');

type MaybeMarkedJSONContent = JSONContent & {
  [MALFORMED_FALLBACK_SYMBOL]?: boolean;
};

function buildMalformedFallbackDoc(rawValue: unknown): MaybeMarkedJSONContent {
  let serialized: string;
  try {
    serialized = JSON.stringify(rawValue);
  } catch {
    serialized = String(rawValue);
  }
  const doc = tiptapContent(`
          This component's content is malformed. Please change it or remove this component.
          Original content: ${serialized}
        `) as MaybeMarkedJSONContent;
  Object.defineProperty(doc, MALFORMED_FALLBACK_SYMBOL, {
    value: true,
    enumerable: false,
  });
  return doc;
}

/**
 * Wraps a plain text string into a basic ProseMirror document JSON structure.
 */
export function tiptapContent(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text
          ? [
              {
                type: 'text',
                text: text,
              },
            ]
          : [],
      },
    ],
  };
}

/**
 * Parses a stored field value (JSON object, JSON string, HTML string, or Markdown string)
 * into a TipTap-compatible `JSONContent` or sanitized HTML string.
 */
export function parseJSONContent(
  value: string | JSONContent | null | undefined,
  defaultValue: string,
  outputFormat: TiptapOutputFormat = 'json'
): JSONContent | string {
  if (value === null || value === undefined || value === '') {
    return tiptapContent(defaultValue);
  }

  if (typeof value === 'object') {
    if (isProseMirrorDocObject(value)) {
      return value;
    }
    console.error('Invalid ProseMirror JSON document:', value);
    return buildMalformedFallbackDoc(value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return tiptapContent(defaultValue);
  }

  // Try JSON first if it looks like JSON and either outputFormat is json or it is a ProseMirror doc
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isProseMirrorDocObject(parsed)) {
        return parsed;
      }
      if (outputFormat === 'json') {
        console.error('Invalid ProseMirror JSON document:', value);
        return buildMalformedFallbackDoc(value);
      }
    } catch {
      // fall through
    }
  }

  if (outputFormat === 'markdown') {
    if (
      LEGACY_HTML_IN_MARKDOWN_RE.test(trimmed) &&
      !MARKDOWN_META_COMMENT_RE.test(trimmed)
    ) {
      return sanitizeHtmlString(trimmed);
    }
    const parsedDoc = markdownToJson(trimmed) as JSONContent;
    return parsedDoc?.type === 'doc' ? parsedDoc : tiptapContent(defaultValue);
  }

  if (outputFormat === 'html' || (trimmed.startsWith('<') && trimmed.endsWith('>'))) {
    return sanitizeHtmlString(trimmed);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (isProseMirrorDocObject(parsed)) {
      return parsed;
    }
    console.error('Invalid ProseMirror JSON document:', value);
    return buildMalformedFallbackDoc(value);
  } catch (e) {
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      const markdownFallback = markdownToJson(trimmed) as JSONContent;
      if (
        markdownFallback?.type === 'doc' &&
        Array.isArray(markdownFallback.content) &&
        markdownFallback.content.length > 0
      ) {
        return markdownFallback;
      }
    }
    console.error('Failed to parse JSON content:', e);
    return buildMalformedFallbackDoc(value);
  }
}

/**
 * Parses a stored field value and strips node/mark types the schema doesn't know. Without this,
 * Tiptap swallows the parse error and mounts an empty document, which the next save would persist.
 */
export function prepareEditorContent(
  value: string | JSONContent | null | undefined,
  schema: SanitizeSchema,
  defaultValue: string = '',
  outputFormat: TiptapOutputFormat = 'json'
): {
  content: JSONContent | string;
  unknownNodeTypes: string[];
  unknownMarkTypes: string[];
  malformed?: boolean;
} {
  const parsed = parseJSONContent(value, defaultValue, outputFormat);
  if (typeof parsed === 'string') {
    return { content: parsed, unknownNodeTypes: [], unknownMarkTypes: [], malformed: false };
  }
  const malformed = Boolean((parsed as MaybeMarkedJSONContent)[MALFORMED_FALLBACK_SYMBOL]);
  const { content, unknownNodeTypes, unknownMarkTypes } = stripUnknownContent(parsed, schema);
  return { content: content as JSONContent, unknownNodeTypes, unknownMarkTypes, malformed };
}

/**
 * React hook that initializes a TipTap editor bound to a Strapi Content-Manager field.
 */
export function useTiptapEditor(
  name: string,
  defaultValue: string = '',
  extensions: Extensions = [],
  options?: UseTiptapEditorOptions
) {
  const field = useField(name);
  const outputFormat = options?.outputFormat ?? 'json';
  const schema = useMemo(() => getSchema(extensions), [extensions]);
  const disabledRef = useRef(Boolean(options?.disabled));
  disabledRef.current = Boolean(options?.disabled);

  // Initial content only, like `useEditor` itself. Nothing is written back here: loading must not
  // dirty the form; the stripped nodes are only lost if the editor saves afterwards.
  const [prepared] = useState(() =>
    prepareEditorContent(field.value, schema, defaultValue, outputFormat)
  );
  const { unknownNodeTypes, unknownMarkTypes } = prepared;

  const removedContent = useMemo<RemovedContent | null>(
    () =>
      unknownNodeTypes.length || unknownMarkTypes.length
        ? { nodeTypes: unknownNodeTypes, markTypes: unknownMarkTypes }
        : null,
    [unknownNodeTypes, unknownMarkTypes]
  );

  useEffect(() => {
    if (!removedContent) return;
    console.warn(
      `[TiptapEditor] Removed unknown content from field "${name}": ` +
        `nodes=[${removedContent.nodeTypes.join(', ')}], marks=[${removedContent.markTypes.join(', ')}]`
    );
  }, [removedContent, name]);

  // A ref, not state: the error fires synchronously inside `useEditor` on the first render, before
  // this hook returns, so the flag is already readable. Editing stays allowed: locking the editor
  // would leave the user no way to repair the entry.
  const contentError = useRef(Boolean(prepared.malformed));

  const editor = useEditor({
    extensions: extensions,
    content: prepared.content,
    editable: !options?.disabled,
    // Safety net for shapes the sanitizer can't fix (invalid attrs, content expression mismatch).
    // `enableContentCheck` stays off so the editor still mounts with whatever Tiptap can recover.
    emitContentError: true,
    onContentError: ({ error }) => {
      contentError.current = true;
      console.error(`[TiptapEditor] Invalid content in field "${name}":`, error);
    },
    onUpdate: ({ editor: ed }) => {
      if (disabledRef.current) return;
      const json = ed.getJSON();
      const serialized = serializeEditorContent(ed, outputFormat, {
        wordsPerMinute: options?.wordsPerMinute,
      });
      field.onChange(name, serialized);
      options?.onDocUpdate?.(json);
    },
  });

  useEffect(() => {
    setEditorEditableWithNodeViews(editor as EditableEditorLike | null, !options?.disabled);
  }, [editor, options?.disabled]);

  return { editor, field, removedContent, contentError: contentError.current };
}

type EditableEditorLike = {
  isDestroyed?: boolean;
  isEditable?: boolean;
  setEditable?: (editable: boolean, emitUpdate?: boolean) => void;
  contentComponent?: unknown;
  createNodeViews?: () => void;
  view?: { isDestroyed?: boolean; setProps?: (props: Record<string, unknown>) => void };
};

/**
 * Updates `editor.setEditable(nextEditable, false)` and refreshes mounted `@tiptap/react` NodeViews
 * when `isEditable` transitions so NodeView controls reflect Preview / disabled mode immediately.
 */
export function setEditorEditableWithNodeViews(
  editor: EditableEditorLike | null | undefined,
  nextEditable: boolean
): void {
  if (!editor || editor.isDestroyed || typeof editor.setEditable !== 'function') return;
  if (editor.isEditable === nextEditable) return;
  editor.setEditable(nextEditable, false);
  if (
    editor.contentComponent &&
    !editor.view?.isDestroyed &&
    typeof editor.view?.setProps === 'function' &&
    typeof editor.createNodeViews === 'function'
  ) {
    editor.view.setProps({ markViews: {}, nodeViews: {} });
    editor.createNodeViews();
  }
}
