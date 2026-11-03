import DOMPurify from 'isomorphic-dompurify';
import { toSafeCellBackgroundColor } from '../table';
import { isSafeIframeUrl, isSafeUrl } from '../urlSafety';

export { isSafeIframeUrl, isSafeUrl, toSafeCellBackgroundColor };

export interface ProseMirrorJSONNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorJSONNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface SanitizeOptions {
  allowedIframeDomains?: string[];
}

const UNSAFE_ATTR_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

const DOMPURIFY_ALLOWED_URI_REGEXP =
  /^(?:(?:https?|mailto|tel):|strapi:\/\/|data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$|data:audio\/(?:mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|aac|flac)(?:;codecs=[a-z0-9.,_-]+)?;base64,[a-z0-9+/=]+$|(?!\/\/|\/\\|\\\\|\\\/)[^a-z:\\]|[a-z0-9+.\-]+(?:[^a-z0-9+.\-:\\]|$))/i;

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
  'sandbox',
  'loading',
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
  'data-caption',
  'data-checked',
  'data-background-color',
  'data-color',
  'target',
  'rel',
  'dir',
  'lang',
  'title',
  'open',
];

const SAFE_IFRAME_SANDBOX_TOKENS = new Set([
  'allow-scripts',
  'allow-same-origin',
  'allow-popups',
  'allow-presentation',
]);

const UNSAFE_CSS_SYNTAX_RE = /url\s*\(|expression\s*\(|javascript:|@import|[{}\\;<>]|\/\*/i;
const SAFE_FONT_FAMILY_RE = /^[a-zA-Z0-9\s,"'-]+$/;
const SAFE_FONT_SIZE_RE = /^\d+(?:\.\d+)?(?:px|rem|em|%|pt)$/i;
const SAFE_LINE_HEIGHT_RE = /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/i;

function isSafeCssColor(raw: unknown): raw is string {
  return typeof raw === 'string' && !UNSAFE_CSS_SYNTAX_RE.test(raw) && Boolean(toSafeCellBackgroundColor(raw));
}

function isSafeFontFamily(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return trimmed.length > 0 && !UNSAFE_CSS_SYNTAX_RE.test(trimmed) && SAFE_FONT_FAMILY_RE.test(trimmed);
}

function isSafeFontSize(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return trimmed.length > 0 && SAFE_FONT_SIZE_RE.test(trimmed);
}

function isSafeLineHeight(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return trimmed.length > 0 && SAFE_LINE_HEIGHT_RE.test(trimmed);
}

function isSafeAllowedCssDeclaration(prop: string, val: string): boolean {
  if (!val || UNSAFE_CSS_SYNTAX_RE.test(val)) return false;
  switch (prop) {
    case 'color':
    case 'background-color':
      return isSafeCssColor(val);
    case 'font-family':
      return isSafeFontFamily(val);
    case 'font-size':
      return isSafeFontSize(val);
    case 'line-height':
      return /^(?:\d+(?:\.\d+)?(?:px|rem|em|%)?|normal)$/i.test(val);
    case 'text-align':
      return /^(?:left|right|center|justify|start|end)$/i.test(val);
    case 'width':
    case 'height':
    case 'max-width':
      return /^(?:auto|fit-content|min-content|max-content|0|\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh))$/i.test(val);
    case 'aspect-ratio':
      return /^(?:auto|\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)$/i.test(val);
    case 'display':
      return /^(?:block|inline|inline-block|flex|inline-flex|grid|none)$/i.test(val);
    case 'margin':
      return /^(?:(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%))(?:\s+(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%))){0,3})$/i.test(
        val
      );
    case 'margin-top':
    case 'margin-left':
    case 'margin-right':
      return /^(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%))$/i.test(val);
    default:
      return false;
  }
}

function sanitizeInlineStyleString(styleStr: string): string {
  const safeDecls: string[] = [];
  for (const decl of styleStr.split(';')) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (isSafeAllowedCssDeclaration(prop, val)) {
      safeDecls.push(`${prop}: ${val}`);
    }
  }
  return safeDecls.join('; ');
}

/**
 * Escapes special HTML attribute characters (`&`, `<`, `>`, `"`, `'`).
 */
export function escAttr(value: unknown): string {
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
export function unescapeHtmlEntities(value: string): string {
  return value
    .replace(/&#91;|&#x5b;/gi, '[')
    .replace(/&#93;|&#x5d;/gi, ']')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Sanitizes an HTML string using DOMPurify (`isomorphic-dompurify`), stripping dangerous elements
 * (`<script>`, `<style>`, `<svg>`, `<math>`, `<form>`, `<object>`, `<embed>`), inline event handlers,
 * `srcdoc`, and unsafe URI schemes while preserving Tiptap editor nodes and data attributes.
 */
export function sanitizeHtmlString(html: string, options?: SanitizeOptions): string {
  if (!html || typeof html !== 'string') return '';

  const afterSanitizeAttributesHook = (node: Element) => {
    const tagName = node.tagName?.toUpperCase();

    if (tagName === 'IFRAME') {
      const src = node.getAttribute('src') ?? '';
      if (!isSafeIframeUrl(src, options?.allowedIframeDomains)) {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        } else {
          node.remove?.();
        }
        return;
      }

      const rawSandbox = node.getAttribute('sandbox') ?? '';
      const filteredTokens: string[] = [];
      for (const token of rawSandbox.split(/\s+/)) {
        const clean = token.trim().toLowerCase();
        if (clean && SAFE_IFRAME_SANDBOX_TOKENS.has(clean) && !filteredTokens.includes(clean)) {
          filteredTokens.push(clean);
        }
      }
      node.setAttribute(
        'sandbox',
        filteredTokens.length > 0 ? filteredTokens.join(' ') : 'allow-scripts allow-popups'
      );

      if (!node.hasAttribute('loading')) {
        node.setAttribute('loading', 'lazy');
      }
    }

    if (tagName === 'A' && node.getAttribute('target')?.trim().toLowerCase() === '_blank') {
      const existingRel = node.getAttribute('rel') ?? '';
      const relTokens: string[] = [];
      for (const token of existingRel.split(/\s+/)) {
        const clean = token.trim();
        if (!clean || clean.toLowerCase() === 'opener') continue;
        if (!relTokens.some((t) => t.toLowerCase() === clean.toLowerCase())) {
          relTokens.push(clean);
        }
      }
      if (!relTokens.some((t) => t.toLowerCase() === 'noopener')) {
        relTokens.push('noopener');
      }
      if (!relTokens.some((t) => t.toLowerCase() === 'noreferrer')) {
        relTokens.push('noreferrer');
      }
      node.setAttribute('rel', relTokens.join(' '));
    }

    if (node.attributes) {
      for (const attr of Array.from(node.attributes)) {
        const attrName = attr.name.toLowerCase();
        if (
          (attrName === 'src' || attrName === 'href' || attrName === 'xlink:href') &&
          /^[\u0000-\u0020]*data:/i.test(attr.value)
        ) {
          if (!isSafeUrl(attr.value)) {
            node.removeAttribute(attr.name);
          }
          continue;
        }
        if (
          attrName.startsWith('data-') &&
          (attrName === 'data-href' ||
            attrName === 'data-url' ||
            attrName.endsWith('-src') ||
            attrName.endsWith('-url') ||
            attrName.endsWith('-href'))
        ) {
          if (attr.value !== '' && !isSafeUrl(attr.value)) {
            node.removeAttribute(attr.name);
          }
        }
      }
    }

    if (node.hasAttribute('style')) {
      const sanitizedStyle = sanitizeInlineStyleString(node.getAttribute('style') ?? '');
      if (sanitizedStyle) {
        node.setAttribute('style', sanitizedStyle);
      } else {
        node.removeAttribute('style');
      }
    }
  };

  DOMPurify.addHook('afterSanitizeAttributes', afterSanitizeAttributesHook);
  try {
    return String(
      DOMPurify.sanitize(html, {
        ADD_TAGS: DOMPURIFY_ADD_TAGS,
        FORBID_TAGS: DOMPURIFY_FORBID_TAGS,
        ADD_ATTR: DOMPURIFY_ADD_ATTR,
        ALLOW_DATA_ATTR: true,
        FORBID_ATTR: ['srcdoc'],
        ALLOWED_URI_REGEXP: DOMPURIFY_ALLOWED_URI_REGEXP,
      })
    );
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', afterSanitizeAttributesHook);
  }
}

/**
 * Formats and validates a URL for safe inclusion inside Markdown link/media syntax.
 */
export function mdUrl(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (!str || !isSafeUrl(str)) return '#';
  return /[\s()<>]/.test(str)
    ? `<${str.replace(/</g, '%3C').replace(/>/g, '%3E')}>`
    : str;
}

/**
 * Unwraps `<...>` around Markdown URLs and validates safety.
 */
export function parseMdUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const unwrapped =
    trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1).trim() : trimmed;
  return isSafeUrl(unwrapped) ? unwrapped : '#';
}

/**
 * Formats `textStyle` mark attributes into a CSS inline style string.
 */
export function formatTextStyleAttr(attrs?: Record<string, unknown>): string {
  if (!attrs) return '';
  const parts: string[] = [];
  if (isSafeCssColor(attrs.color)) {
    parts.push(`color: ${attrs.color.trim()}`);
  }
  if (isSafeFontFamily(attrs.fontFamily)) {
    parts.push(`font-family: ${attrs.fontFamily.trim()}`);
  }
  if (isSafeFontSize(attrs.fontSize)) {
    parts.push(`font-size: ${attrs.fontSize.trim()}`);
  }
  if (isSafeLineHeight(attrs.lineHeight)) {
    parts.push(`line-height: ${attrs.lineHeight.trim()}`);
  }
  return parts.join('; ');
}

/**
 * Parses an inline CSS style string from a `<span style="...">` tag into `textStyle` mark attributes.
 */
export function parseTextStyleAttr(styleStr: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  for (const decl of styleStr.split(';')) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val) continue;
    if (prop === 'color' && isSafeCssColor(val)) attrs.color = val;
    else if (prop === 'font-family' && isSafeFontFamily(val)) attrs.fontFamily = val;
    else if (prop === 'font-size' && isSafeFontSize(val)) attrs.fontSize = val;
    else if (prop === 'line-height' && isSafeLineHeight(val)) attrs.lineHeight = val;
  }
  return attrs;
}

/**
 * Sanitizes URL and style attributes inside a restored ProseMirror JSON node tree so metadata comments
 * or untrusted JSON payloads cannot bypass URL/CSS validation.
 */
export function sanitizeRestoredNodeTree(
  node: ProseMirrorJSONNode,
  options?: SanitizeOptions
): ProseMirrorJSONNode {
  const copy: ProseMirrorJSONNode = { ...node };
  if (copy.attrs && typeof copy.attrs === 'object' && !Array.isArray(copy.attrs)) {
    const attrs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(copy.attrs)) {
      if (UNSAFE_ATTR_KEYS.has(key)) continue;
      if ((copy.type === 'tableCell' || copy.type === 'tableHeader') && key === 'backgroundColor') {
        attrs[key] = value === null ? null : toSafeCellBackgroundColor(value);
        continue;
      }
      if (typeof value !== 'string') {
        attrs[key] = value;
        continue;
      }
      if (key === 'src') {
        if (copy.type === 'iframe') {
          attrs[key] = value
            ? isSafeIframeUrl(value, options?.allowedIframeDomains)
              ? value
              : ''
            : '';
        } else {
          attrs[key] = value ? (isSafeUrl(value) ? value : '#') : '';
        }
      } else if (key === 'embedUrl' || key === 'iframeSrc') {
        attrs[key] = value
          ? isSafeIframeUrl(value, options?.allowedIframeDomains)
            ? value
            : ''
          : '';
      } else if (
        key === 'href' ||
        key === 'url' ||
        key === 'data-href' ||
        key === 'data-url' ||
        key === 'data-src' ||
        key.endsWith('Src') ||
        key.endsWith('Url') ||
        key.endsWith('Href') ||
        key.endsWith('-src') ||
        key.endsWith('-url') ||
        key.endsWith('-href')
      ) {
        attrs[key] = value ? (isSafeUrl(value) ? value : '#') : '';
      } else {
        attrs[key] = value;
      }
    }
    copy.attrs = attrs;
  }
  if (Array.isArray(copy.marks)) {
    copy.marks = copy.marks.map((m) => {
      if (!m.attrs || typeof m.attrs !== 'object' || Array.isArray(m.attrs)) {
        return m;
      }
      if (m.type === 'textStyle') {
        const nextAttrs: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(m.attrs)) {
          if (UNSAFE_ATTR_KEYS.has(key)) continue;
          if (key === 'color') {
            if (val === null) nextAttrs.color = null;
            else if (isSafeCssColor(val)) nextAttrs.color = val.trim();
          } else if (key === 'fontFamily') {
            if (val === null) nextAttrs.fontFamily = null;
            else if (isSafeFontFamily(val)) nextAttrs.fontFamily = val.trim();
          } else if (key === 'fontSize') {
            if (val === null) nextAttrs.fontSize = null;
            else if (isSafeFontSize(val)) nextAttrs.fontSize = val.trim();
          } else if (key === 'lineHeight') {
            if (val === null) nextAttrs.lineHeight = null;
            else if (isSafeLineHeight(val)) nextAttrs.lineHeight = val.trim();
          }
        }
        return { ...m, attrs: nextAttrs };
      }
      if (m.type === 'highlight') {
        const nextAttrs: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(m.attrs)) {
          if (UNSAFE_ATTR_KEYS.has(key)) continue;
          if (key === 'color') {
            if (val === null) {
              nextAttrs.color = null;
            } else {
              const safeColor = toSafeCellBackgroundColor(val);
              if (safeColor) nextAttrs.color = safeColor;
            }
          } else {
            nextAttrs[key] = val;
          }
        }
        return { ...m, attrs: nextAttrs };
      }
      const nextAttrs: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(m.attrs)) {
        if (UNSAFE_ATTR_KEYS.has(key)) continue;
        if (key === 'href' && typeof val === 'string') {
          nextAttrs.href = isSafeUrl(val) ? val : '#';
        } else {
          nextAttrs[key] = val;
        }
      }
      return { ...m, attrs: nextAttrs };
    });
  }
  if (Array.isArray(copy.content)) {
    copy.content = copy.content.map((child) => sanitizeRestoredNodeTree(child, options));
  }
  return copy;
}
