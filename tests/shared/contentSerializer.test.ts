import { describe, it, expect } from 'vitest';
import {
  isSafeUrl,
  isSafeIframeUrl,
  sanitizeHtmlString,
  sanitizeRestoredNodeTree,
  jsonToMarkdown,
  markdownToJson,
  extractTextFromJsonNode,
  computeDocumentStats,
  buildExportedJsonDocument,
  serializeEditorContent,
} from '../../shared/src/contentSerializer';
import { formatTextStyleAttr, parseTextStyleAttr } from '../../shared/src/serializers/sanitizers';
import {
  encodeNodeMetaComment,
  serializeBlockToMarkdown,
} from '../../shared/src/serializers/markdownSerializer';

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

    it('rejects javascript:, vbscript:, data:text/html, protocol-relative URLs, and empty URLs without throwing on out-of-range numeric entities', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('  JAVASCRIPT:alert(1) ')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('//evil.com/xss')).toBe(false);
      expect(isSafeUrl('/\\evil.com/xss')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl('https://x.test/?a=&#1114112;')).toBe(true);
      expect(isSafeUrl('https://x.test/?a=&#x110000;')).toBe(true);
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

    it('blocks slash-separated event handlers, unquoted javascript: URLs, entity-encoded schemes, and iframe srcdoc', () => {
      const dirty = [
        '<img/onerror=alert(1) src="https://example.com/a.png">',
        '<a href=javascript:alert(1)>Unquoted</a>',
        '<a href="&#106;avascript:alert(1)">Entity</a>',
        '<a href="//evil.com/phish">ProtocolRelative</a>',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        '<svg onload="alert(1)"><circle /></svg>',
      ].join('');
      const clean = sanitizeHtmlString(dirty);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('javascript');
      expect(clean).not.toContain('&#106;');
      expect(clean).not.toContain('//evil.com');
      expect(clean).not.toContain('srcdoc');
      expect(clean).not.toContain('<svg');
    });
  });

  describe('jsonToMarkdown & markdownToJson', () => {
    it('converts ProseMirror JSON to Markdown and back with inline marks and block structures', () => {
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
              { type: 'text', text: ' and ' },
              { type: 'text', marks: [{ type: 'italic' }], text: 'Italic' },
              { type: 'text', text: ' plus ' },
              { type: 'text', marks: [{ type: 'code' }], text: 'inlineCode' },
              { type: 'text', text: ' and ' },
              {
                type: 'text',
                marks: [{ type: 'link', attrs: { href: 'https://strapi.io' } }],
                text: 'Strapi',
              },
            ],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First item' }] }],
              },
            ],
          },
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted wisdom' }] }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'ts' },
            content: [{ type: 'text', text: 'const x = 1;' }],
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
          {
            type: 'horizontalRule',
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(md).toContain('## Section Title');
      expect(md).toContain('Hello **World** and *Italic* plus `inlineCode` and [Strapi](https://strapi.io)');
      expect(md).toContain('1. First item');
      expect(md).toContain('> Quoted wisdom');
      expect(md).toContain('```ts\nconst x = 1;\n```');
      expect(md).toContain('- [x] Ship plugin');
      expect(md).toContain('---');

      const parsed = markdownToJson(md);
      expect(parsed.type).toBe('doc');
      expect(parsed.content?.[0]?.type).toBe('heading');
      expect(parsed.content?.[1]?.content?.some((n: any) => n.marks?.some((m: any) => m.type === 'bold'))).toBe(true);
      expect(parsed.content?.[1]?.content?.some((n: any) => n.marks?.some((m: any) => m.type === 'italic'))).toBe(true);
      expect(parsed.content?.[1]?.content?.some((n: any) => n.marks?.some((m: any) => m.type === 'code'))).toBe(true);
      expect(parsed.content?.[1]?.content?.some((n: any) => n.marks?.some((m: any) => m.type === 'link'))).toBe(true);
      expect(parsed.content?.some((n: any) => n.type === 'orderedList')).toBe(true);
      expect(parsed.content?.some((n: any) => n.type === 'blockquote')).toBe(true);
      expect(parsed.content?.some((n: any) => n.type === 'codeBlock')).toBe(true);
      expect(parsed.content?.some((n: any) => n.type === 'taskList')).toBe(true);
      expect(parsed.content?.some((n: any) => n.type === 'horizontalRule')).toBe(true);
    });

    it('escapes HTML in abbr/language marks and wraps URLs containing parentheses', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '<script>x</script>',
                marks: [{ type: 'abbr', attrs: { title: 'a" onclick="evil()' } }],
              },
            ],
          },
          {
            type: 'image',
            attrs: { src: 'https://example.com/img(1).png', alt: 'paren' },
          },
        ],
      };
      const md = jsonToMarkdown(doc);
      expect(md).toContain('&lt;script&gt;x&lt;/script&gt;');
      expect(md).toContain('title="a&quot; onclick=&quot;evil()"');
      expect(md).toContain('![paren](<https://example.com/img(1).png>)');
    });

    it('preserves full document structure, inline marks, and attributes on a JSON -> Markdown -> JSON round-trip of fixtures/all-features-payload.json', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const fixturePath = path.resolve(__dirname, '../../fixtures/all-features-payload.json');
      const allFeaturesPayload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      const markdown = jsonToMarkdown(allFeaturesPayload);
      const roundTripped = markdownToJson(markdown);

      expect(roundTripped).toEqual(allFeaturesPayload);
    });

    it('round-trips neutral and tip informationPane variants without metadata comments', () => {
      const parsed = markdownToJson('> [!NEUTRAL] Note\n> Neutral body\n\n> [!TIP] Pro Tip\n> Tip body');
      expect(parsed.content?.[0]).toEqual({
        type: 'informationPane',
        attrs: { variant: 'neutral', title: 'Note' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Neutral body' }] }],
      });
      expect(parsed.content?.[1]).toEqual({
        type: 'informationPane',
        attrs: { variant: 'tip', title: 'Pro Tip' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tip body' }] }],
      });
    });

    it('does not carry storedNode.attrs onto a different block type when Markdown is edited', () => {
      const storedImageNode = {
        type: 'image',
        attrs: {
          src: 'https://example.com/old.png',
          alt: 'Old',
          'data-asset-id': 99,
        },
      };
      const editedMd = `Plain paragraph text\n<!-- tiptap-node:${JSON.stringify(storedImageNode)} -->`;
      const parsed = markdownToJson(editedMd);
      expect(parsed.content?.[0]?.type).toBe('paragraph');
      expect(parsed.content?.[0]?.attrs).toBeUndefined();
    });

    it('round-trips codeBlock containing nested triple-backtick fences and blank lines without splitting', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'markdown' },
            content: [
              {
                type: 'text',
                text: 'Example:\n\n```ts\nconst x = 1;\n```\n\nDone.',
              },
            ],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(md.startsWith('````markdown\n')).toBe(true);
      expect(markdownToJson(md)).toEqual(doc);
    });

    it('preserves iframe sandbox attribute during sanitizeHtmlString', () => {
      const html =
        '<iframe src="https://www.youtube.com/embed/abc" sandbox="allow-scripts allow-same-origin" loading="lazy"></iframe>';
      const sanitized = sanitizeHtmlString(html);
      expect(sanitized).toContain('sandbox="allow-scripts allow-same-origin"');
      expect(sanitized).toContain('loading="lazy"');
    });

    it('round-trips trailing and consecutive hardBreak nodes inside a paragraph without losing breaks or splitting blocks', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Trailing break' },
              { type: 'hardBreak' },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'First line' },
              { type: 'hardBreak' },
              { type: 'hardBreak' },
              { type: 'text', text: 'After double break' },
            ],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(markdownToJson(md)).toEqual(doc);
    });

    it('round-trips non-codeBlock/mathematics blocks containing unclosed fence or math delimiter lines without swallowing subsequent blocks', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '```js' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: '$$' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Still a separate heading' }],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(markdownToJson(md)).toEqual(doc);
    });

    it('wraps display math blocks in a paragraph node and serializes block displayMode with $$ delimiters', () => {
      const parsed = markdownToJson('$$\nx\n$$');
      expect(parsed.content?.[0]?.type).toBe('paragraph');
      expect(parsed.content?.[0]?.content).toEqual([
        {
          type: 'mathematics',
          attrs: { latex: 'x', displayMode: 'block' },
        },
      ]);
      const serialized = jsonToMarkdown(parsed);
      expect(serialized).toContain('$$\nx\n$$');

      const legacyBoolDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'mathematics',
                attrs: { latex: 'E=mc^2', displayMode: true },
              },
            ],
          },
        ],
      };
      expect(jsonToMarkdown(legacyBoolDoc)).toContain('$$\nE=mc^2\n$$');
    });

    it('escapes angle brackets in metadata comments and image alt text so literal <details> does not merge subsequent blocks', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: '<details>' }],
          },
          {
            type: 'image',
            attrs: { src: 'https://example.com/diagram.png', alt: '<details>' },
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Heading After Details Literal' }],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(md).toContain('\\u003cdetails\\u003e');
      expect(markdownToJson(md)).toEqual(doc);
    });

    it('preserves visible fenced code block Markdown inside a details container and round-trips cleanly', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'details',
            attrs: { open: true },
            content: [
              {
                type: 'detailsSummary',
                content: [{ type: 'text', text: 'Code Example' }],
              },
              {
                type: 'detailsContent',
                content: [
                  {
                    type: 'codeBlock',
                    attrs: { language: 'ts' },
                    content: [{ type: 'text', text: 'const answer = 42;' }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(md).toContain('```ts\nconst answer = 42;\n```');
      expect(markdownToJson(md)).toEqual(doc);
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

    it('serializes to JSON string by default and exports words, characters, and reading time', () => {
      const out = serializeEditorContent(mockEditor, 'json');
      const parsed = JSON.parse(out);
      expect(parsed.type).toBe('doc');
      expect(parsed.words).toBe(2);
      expect(parsed.characters).toBe(18);
      expect(parsed.readingTimeMinutes).toBe(1);
      expect(parsed.readingTime).toBe('1 min read');
      expect(parsed.stats).toEqual({
        words: 2,
        characters: 18,
        readingTimeMinutes: 1,
        readingTime: '1 min read',
        wordsPerMinute: 200,
      });
    });

    it('serializes to sanitized HTML when outputFormat is html', () => {
      const out = serializeEditorContent(mockEditor, 'html');
      expect(out).toBe('<p>Serialized content</p>');
    });

    it('serializes to Markdown when outputFormat is markdown', () => {
      const out = serializeEditorContent(mockEditor, 'markdown');
      expect(out).toBe('Serialized content');
    });

    it('sanitizes unsafe links, iframes, and CSS injections in buildExportedJsonDocument while preserving empty doc shape', () => {
      const emptyExport = buildExportedJsonDocument({ getJSON: () => null });
      expect(emptyExport.type).toBe('doc');
      expect(emptyExport.content).toEqual([]);
      expect(emptyExport.words).toBe(0);
      expect(emptyExport.characters).toBe(0);

      const dirtyExport = buildExportedJsonDocument(
        {
          getJSON: () => ({
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Click me',
                    marks: [
                      { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                      {
                        type: 'textStyle',
                        attrs: {
                          color: 'red; background: url(https://evil.test)',
                          fontFamily: 'Georgia, serif',
                          fontSize: '18px',
                        },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'iframe',
                attrs: { src: 'https://evil.example.com/embed', title: 'Untrusted' },
              },
            ],
          }),
        },
        { allowedIframeDomains: ['youtube.com'] }
      );

      const content = dirtyExport.content as any[];
      expect(content[0].content[0].marks[0].attrs.href).toBe('#');
      expect(content[0].content[0].marks[1].attrs).toEqual({
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
      });
      expect(content[1].attrs.src).toBe('');
    });

    it('includes button/atom labels and custom container blocks cleanly in extractTextFromJsonNode and computeDocumentStats', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'callout',
            attrs: { tone: 'info' },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph' }] },
            ],
          },
          {
            type: 'button',
            attrs: { label: 'Start free trial', href: 'https://example.com' },
          },
          {
            type: 'badge',
            attrs: { label: 'Beta' },
          },
        ],
      };

      const extracted = extractTextFromJsonNode(doc);
      expect(extracted).toBe('First paragraph\nSecond paragraph\nStart free trial\nBeta');
      const stats = computeDocumentStats(doc);
      expect(stats.words).toBe(8);
    });
  });

  describe('security & round-trip regressions', () => {
    it('rejects backslash-leading URLs and enforces strict base64 MIME allowlists for data:image/* and data:audio/*', () => {
      expect(isSafeUrl('\\evil.com/xss')).toBe(false);
      expect(isSafeUrl('\\\\evil.com/xss')).toBe(false);
      expect(isSafeUrl('\\/evil.com/xss')).toBe(false);
      expect(isSafeUrl('/\\evil.com/xss')).toBe(false);

      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(true);
      expect(isSafeUrl('data:image/webp;base64, UklGRhIAAABX\nRUJQVlA4 ')).toBe(true);
      expect(isSafeUrl('data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC')).toBe(true);
      expect(isSafeUrl('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0U=')).toBe(true);

      expect(isSafeUrl('data:image/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj4=')).toBe(false);
      expect(isSafeUrl('data:image/svg%2bxml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj4=')).toBe(false);
      expect(isSafeUrl('data:image/png,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:audio/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('data:audio/mpeg,<script>alert(1)</script>')).toBe(false);
    });

    it('enforces iframe domain/HTTPS/sandbox rules, target=_blank rel hardening, data-href/url/src checks, backslash URI rejection, and style allowlisting in sanitizeHtmlString', () => {
      // Disallowed / non-HTTPS iframes removed
      expect(
        sanitizeHtmlString('<p>Before</p><iframe src="http://www.youtube.com/embed/abc"></iframe>')
      ).toBe('<p>Before</p>');
      expect(
        sanitizeHtmlString('<iframe src="https://evil.example.com/embed"></iframe>', {
          allowedIframeDomains: ['youtube.com'],
        })
      ).toBe('');

      // Valid iframe gets unsafe sandbox tokens stripped and default sandbox/loading applied
      const sandboxed = sanitizeHtmlString(
        '<iframe src="https://www.youtube.com/embed/abc" sandbox="allow-top-navigation allow-forms"></iframe>',
        { allowedIframeDomains: ['youtube.com'] }
      );
      expect(sandboxed).toContain('sandbox="allow-scripts allow-popups"');
      expect(sandboxed).toContain('loading="lazy"');

      // Hook does not leak to subsequent calls without options
      const unrestrictedNextCall = sanitizeHtmlString(
        '<iframe src="https://example.org/widget" loading="eager"></iframe>'
      );
      expect(unrestrictedNextCall).toContain('src="https://example.org/widget"');
      expect(unrestrictedNextCall).toContain('loading="eager"');

      // <a target="_blank"> strips opener and enforces noopener noreferrer
      const targetBlankHtml = sanitizeHtmlString(
        '<a href="https://example.com" target="_blank" rel="opener nofollow">External</a>'
      );
      expect(targetBlankHtml).not.toContain('"opener');
      expect(targetBlankHtml).not.toContain(' opener');
      expect(targetBlankHtml).toContain('nofollow');
      expect(targetBlankHtml).toContain('noopener');
      expect(targetBlankHtml).toContain('noreferrer');

      // Backslash-leading URLs and unsafe data:audio / data:image/svg+xml rejected in HTML
      const backslashHtml = sanitizeHtmlString(
        '<a href="\\\\evil.com">A</a><a href="\\/evil.com">B</a><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="data:image/png;base64,iVBORw0KGgo="><audio src="data:audio/html,evil"></audio><audio src="data:audio/webm;codecs=opus;base64,GkXf=="></audio>'
      );
      expect(backslashHtml).not.toContain('evil.com');
      expect(backslashHtml).not.toContain('data:image/svg');
      expect(backslashHtml).toContain('data:image/png;base64,iVBORw0KGgo=');
      expect(backslashHtml).not.toContain('data:audio/html');
      expect(backslashHtml).toContain('data:audio/webm;codecs=opus;base64,GkXf==');

      // data-href / data-url / *-src / *-url sanitized on custom component elements
      const customCompHtml = sanitizeHtmlString(
        '<div data-component="button" data-href="javascript:alert(1)" data-url="https://strapi.io" data-before-src="vbscript:evil" data-empty-url=""></div>'
      );
      expect(customCompHtml).not.toContain('javascript:');
      expect(customCompHtml).not.toContain('vbscript:');
      expect(customCompHtml).toContain('data-url="https://strapi.io"');
      expect(customCompHtml).toContain('data-empty-url=""');

      // Inline style sanitization: blocks position:fixed / z-index / url() while keeping safe Tiptap styles
      const styledHtml = sanitizeHtmlString(
        '<div style="position: fixed; z-index: 99999; background: url(https://evil.test)">Overlay</div>' +
          '<span style="color: #0052cc; font-family: Georgia, serif; font-size: 18px; line-height: 1.75; position: fixed">Text</span>'
      );
      expect(styledHtml).toContain('<div>Overlay</div>');
      expect(styledHtml).not.toContain('position');
      expect(styledHtml).not.toContain('z-index');
      expect(styledHtml).not.toContain('url(');
      expect(styledHtml).toContain(
        'style="color: #0052cc; font-family: Georgia, serif; font-size: 18px; line-height: 1.75"'
      );
    });

    it('validates CSS values in formatTextStyleAttr, parseTextStyleAttr, and sanitizeRestoredNodeTree', () => {
      expect(
        formatTextStyleAttr({
          color: '#0052cc',
          fontFamily: 'Georgia, serif',
          fontSize: '18px',
          lineHeight: '1.75',
        })
      ).toBe('color: #0052cc; font-family: Georgia, serif; font-size: 18px; line-height: 1.75');

      expect(
        formatTextStyleAttr({
          color: 'red; position: fixed',
          fontFamily: 'Arial; background: url(evil)',
          fontSize: 'calc(100vw)',
          lineHeight: 'expression(1)',
        })
      ).toBe('');

      expect(
        parseTextStyleAttr(
          'color: rgb(10, 20, 30); font-family: Georgia, serif; font-size: 1.25rem; line-height: 1.5; position: fixed'
        )
      ).toEqual({
        color: 'rgb(10, 20, 30)',
        fontFamily: 'Georgia, serif',
        fontSize: '1.25rem',
        lineHeight: '1.5',
      });

      expect(
        parseTextStyleAttr(
          'color: url(evil); font-family: Arial}; font-size: 10px\\9; line-height: 1;bad'
        )
      ).toEqual({ lineHeight: '1' });

      const restored = sanitizeRestoredNodeTree(
        {
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: '', alt: 'Empty src kept' } },
            { type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'Unsafe src replaced' } },
            { type: 'iframe', attrs: { src: 'https://evil.com/x' } },
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    {
                      type: 'tableCell',
                      attrs: { backgroundColor: 'red; background-image: url(x)' },
                      content: [
                        {
                          type: 'paragraph',
                          content: [
                            {
                              type: 'text',
                              text: 'Cell',
                              marks: [
                                {
                                  type: 'highlight',
                                  attrs: { color: 'yellow; position: fixed' },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { allowedIframeDomains: ['youtube.com'] }
      );

      expect(restored.content?.[0]?.attrs?.src).toBe('');
      expect(restored.content?.[1]?.attrs?.src).toBe('#');
      expect(restored.content?.[2]?.attrs?.src).toBe('');
      const cell = restored.content?.[3]?.content?.[0]?.content?.[0];
      expect(cell?.attrs?.backgroundColor).toBeNull();
      expect(cell?.content?.[0]?.content?.[0]?.marks?.[0]?.attrs).toEqual({});
    });

    it('escapes brackets in Markdown link/media labels and supports CommonMark titles on images and links', () => {
      const parsedImg = markdownToJson('![Hero &#91;1&#93;](https://example.com/a.jpg "Credit")');
      expect(parsedImg.content?.[0]).toEqual({
        type: 'image',
        attrs: {
          alt: 'Hero [1]',
          src: 'https://example.com/a.jpg',
          title: 'Credit',
        },
      });
      expect(jsonToMarkdown(parsedImg)).toBe(
        '![Hero &#91;1&#93;](https://example.com/a.jpg "Credit")'
      );

      const parsedSingleQuoteLink = markdownToJson(
        "Read [Guide &#91;v2&#93;](https://example.com/guide 'Docs Title') and ![Inline](https://example.com/i.png 'Inline Title')"
      );
      expect(parsedSingleQuoteLink.content?.[0]?.content?.[1]).toEqual({
        type: 'text',
        text: 'Guide [v2]',
        marks: [{ type: 'link', attrs: { href: 'https://example.com/guide', title: 'Docs Title' } }],
      });
      expect(parsedSingleQuoteLink.content?.[0]?.content?.[3]).toEqual({
        type: 'image',
        attrs: {
          src: 'https://example.com/i.png',
          alt: 'Inline',
          title: 'Inline Title',
        },
      });

      const mediaBracketDoc = {
        type: 'doc',
        content: [
          { type: 'video', attrs: { title: 'Clip [HD]', src: 'https://example.com/v.mp4' } },
          { type: 'audio', attrs: { title: 'Track [1]', src: 'https://example.com/a.mp3' } },
          {
            type: 'attachment',
            attrs: {
              filename: 'spec[final].pdf',
              title: 'spec[final].pdf',
              href: 'https://example.com/spec.pdf',
              src: 'https://example.com/spec.pdf',
            },
          },
          { type: 'iframe', attrs: { title: 'Map [Live]', src: 'https://www.youtube.com/embed/1' } },
          {
            type: 'paragraph',
            content: [
              {
                type: 'linker',
                attrs: {
                  collectionName: 'api::article.article',
                  documentId: 'doc-1',
                  label: 'Ref [A]',
                  href: 'strapi://api::article.article/doc-1',
                },
              },
              { type: 'text', text: ' ' },
              {
                type: 'text',
                text: 'Link [B]',
                marks: [{ type: 'link', attrs: { href: 'https://example.com/b' } }],
              },
            ],
          },
        ],
      };

      const md = jsonToMarkdown(mediaBracketDoc);
      expect(markdownToJson(md)).toEqual(mediaBracketDoc);
    });

    it('strips fence/newline injections in codeBlock/informationPane/conversationHistory and escapes -- in metadata comments', () => {
      const commentStr = encodeNodeMetaComment({
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{ type: 'text', text: 'Breakout --> attempt --!> here' }],
      });
      expect(commentStr.slice('<!-- tiptap-node:'.length, -' -->'.length)).not.toContain('--');

      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: 'Breakout --> attempt --!> here' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'ts`\n```\nInjected' },
            content: [{ type: 'text', text: 'const safe = true;' }],
          },
          {
            type: 'informationPane',
            attrs: { variant: 'info', title: 'Header\nInjected paragraph' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
          },
          {
            type: 'conversationHistory',
            attrs: { author: 'Alice\nBob', timestamp: '2026-11-02\n12:00' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note' }] }],
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(markdownToJson(md)).toEqual(doc);
    });

    it('escapes pipes in table cells, unescapes on parse, and preserves cell-level attrs when a table is edited in Markdown', () => {
      const pipeTableDoc = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Expr A | B' }] }],
                  },
                  {
                    type: 'tableHeader',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Result' }] }],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x | y' }] }],
                  },
                  {
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'true' }] }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const pipeMd = jsonToMarkdown(pipeTableDoc);
      expect(pipeMd).toContain('Expr A \\| B');
      expect(pipeMd).toContain('x \\| y');
      expect(markdownToJson(pipeMd)).toEqual(pipeTableDoc);

      const richTableNode = {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { colspan: 1, rowspan: 1, colwidth: [200], backgroundColor: '#EDF2F7' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header' }] }],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                attrs: { colspan: 1, rowspan: 1, colwidth: [200], backgroundColor: '#FEFCBF' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old Value' }] }],
              },
            ],
          },
        ],
      };

      const editedTableMd = [
        '| Header |',
        '| --- |',
        '| Updated Value |',
        encodeNodeMetaComment(richTableNode),
      ].join('\n');

      const reparsedEdited = markdownToJson(editedTableMd);
      const editedHeader = reparsedEdited.content?.[0]?.content?.[0]?.content?.[0];
      const editedCell = reparsedEdited.content?.[0]?.content?.[1]?.content?.[0];
      expect(editedHeader?.attrs).toEqual({
        colspan: 1,
        rowspan: 1,
        colwidth: [200],
        backgroundColor: '#EDF2F7',
      });
      expect(editedCell?.attrs).toEqual({
        colspan: 1,
        rowspan: 1,
        colwidth: [200],
        backgroundColor: '#FEFCBF',
      });
      expect(editedCell?.content?.[0]?.content?.[0]?.text).toBe('Updated Value');
    });

    it('serializes custom container blocks with jsonToMarkdownPure instead of merging paragraphs inline and threads allowedIframeDomains', () => {
      const customCallout = {
        type: 'callout',
        attrs: { tone: 'warning' },
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First block' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second block' }] },
        ],
      };
      expect(serializeBlockToMarkdown(customCallout)).toBe('First block\n\nSecond block');

      const docWithCallout = { type: 'doc', content: [customCallout] };
      expect(markdownToJson(jsonToMarkdown(docWithCallout))).toEqual(docWithCallout);

      const iframeDoc = {
        type: 'doc',
        content: [
          {
            type: 'iframe',
            attrs: { title: 'Blocked Embed', src: 'https://evil.example.com/embed' },
          },
        ],
      };
      const mdRestricted = jsonToMarkdown(iframeDoc, { allowedIframeDomains: ['youtube.com'] });
      expect(mdRestricted).not.toContain('evil.example.com');
      const parsedRestricted = markdownToJson(
        '[Embed: Blocked Embed](https://evil.example.com/embed)',
        { allowedIframeDomains: ['youtube.com'] }
      );
      expect(parsedRestricted.content?.[0]?.attrs?.src).toBe('');
    });

    it('round-trips links and images whose URLs contain apostrophes alongside CommonMark titles', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Conway',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: "https://en.wikipedia.org/wiki/Conway's_Game_of_Life",
                      title: 'Wiki',
                    },
                  },
                ],
              },
            ],
          },
          {
            type: 'image',
            attrs: {
              src: "https://cdn.example.com/chef's.jpg",
              alt: 'Chef',
              title: 'Photo',
            },
          },
        ],
      };

      const md = jsonToMarkdown(doc);
      expect(markdownToJson(md)).toEqual(doc);
      expect(
        markdownToJson("![Chef](https://cdn.example.com/chef's.jpg 'Photo')").content?.[0]
      ).toEqual({
        type: 'image',
        attrs: {
          src: "https://cdn.example.com/chef's.jpg",
          alt: 'Chef',
          title: 'Photo',
        },
      });
    });
  });
});
