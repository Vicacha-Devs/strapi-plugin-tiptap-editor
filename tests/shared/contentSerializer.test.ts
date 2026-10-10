import { describe, it, expect } from 'vitest';
import {
  isSafeUrl,
  isSafeIframeUrl,
  sanitizeHtmlString,
  jsonToMarkdown,
  markdownToJson,
  serializeEditorContent,
} from '../../shared/contentSerializer';

describe('shared/contentSerializer', () => {
  describe('isSafeUrl', () => {
    it('allows https, http, mailto, tel, strapi://, relative paths, and anchors', () => {
      expect(isSafeUrl('https://strapi.io')).toBe(true);
      expect(isSafeUrl('http://example.com/file.pdf')).toBe(true);
      expect(isSafeUrl('mailto:team@example.com')).toBe(true);
      expect(isSafeUrl('tel:+123456789')).toBe(true);
      expect(isSafeUrl('strapi://api::article.article/doc-1')).toBe(true);
      expect(isSafeUrl('/uploads/image.png')).toBe(true);
      expect(isSafeUrl('#section-1')).toBe(true);
    });

    it('rejects javascript:, vbscript:, data:text/html, and empty URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('  JAVASCRIPT:alert(1) ')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
    });
  });

  describe('isSafeIframeUrl', () => {
    it('enforces https and validates against optional allowed domains', () => {
      expect(isSafeIframeUrl('https://www.youtube.com/embed/xyz')).toBe(true);
      expect(isSafeIframeUrl('http://www.youtube.com/embed/xyz')).toBe(false);
      expect(
        isSafeIframeUrl('https://player.vimeo.com/video/123', ['youtube.com', 'vimeo.com'])
      ).toBe(true);
      expect(
        isSafeIframeUrl('https://evil.example.com/embed', ['youtube.com', 'vimeo.com'])
      ).toBe(false);
    });
  });

  describe('sanitizeHtmlString', () => {
    it('removes script tags, event handlers, and javascript: URLs', () => {
      const dirty =
        '<p onclick="alert(1)">Hello <script>evil()</script><a href="javascript:xss()">Click</a></p>';
      const clean = sanitizeHtmlString(dirty);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('javascript:');
      expect(clean).toContain('<p>Hello ');
    });
  });

  describe('jsonToMarkdown & markdownToJson', () => {
    it('converts ProseMirror JSON to Markdown and back', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Section Title' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', marks: [{ type: 'bold' }], text: 'World' },
            ],
          },
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Ship plugin' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(md).toContain('## Section Title');
      expect(md).toContain('Hello **World**');
      expect(md).toContain('- [x] Ship plugin');

      const parsed = markdownToJson(md);
      expect(parsed.type).toBe('doc');
      expect(parsed.content?.[0]?.type).toBe('heading');
      expect(parsed.content?.[2]?.type).toBe('taskList');
    });
  });

  describe('serializeEditorContent', () => {
    const mockEditor = {
      getJSON: () => ({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Serialized content' }],
          },
        ],
      }),
      getHTML: () => '<p onclick="evil()">Serialized content</p>',
    };

    it('serializes to JSON string by default', () => {
      const out = serializeEditorContent(mockEditor, 'json');
      expect(JSON.parse(out).type).toBe('doc');
    });

    it('serializes to sanitized HTML when outputFormat is html', () => {
      const out = serializeEditorContent(mockEditor, 'html');
      expect(out).toBe('<p>Serialized content</p>');
    });

    it('serializes to Markdown when outputFormat is markdown', () => {
      const out = serializeEditorContent(mockEditor, 'markdown');
      expect(out).toBe('Serialized content');
    });
  });
});
