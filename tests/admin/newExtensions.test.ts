import { describe, it, expect, vi } from 'vitest';

vi.mock('@strapi/design-system', () => ({
  Box: 'Box',
  Button: 'Button',
  Dialog: { Root: 'DialogRoot', Content: 'DialogContent', Header: 'DialogHeader', Body: 'DialogBody', Footer: 'DialogFooter', Cancel: 'DialogCancel', Action: 'DialogAction' },
  Field: { Root: 'FieldRoot', Label: 'FieldLabel', Hint: 'FieldHint', Error: 'FieldError' },
  Flex: 'Flex',
  IconButton: 'IconButton',
  Popover: { Root: 'PopoverRoot', Trigger: 'PopoverTrigger', Content: 'PopoverContent' },
  SingleSelect: 'SingleSelect',
  SingleSelectOption: 'SingleSelectOption',
  TextInput: 'TextInput',
  Textarea: 'Textarea',
  Tooltip: 'Tooltip',
  Typography: 'Typography',
}));

vi.mock('@strapi/icons', () => ({
  Bold: 'Bold',
  Italic: 'Italic',
  Underline: 'Underline',
  StrikeThrough: 'StrikeThrough',
  Code: 'Code',
  Quotes: 'Quotes',
  BulletList: 'BulletList',
  NumberList: 'NumberList',
  Link: 'Link',
  Image: 'Image',
  Play: 'Play',
  VolumeUp: 'VolumeUp',
  Microphone: 'Microphone',
  Paperclip: 'Paperclip',
  CodeBlock: 'CodeBlock',
  EmotionHappy: 'EmotionHappy',
  Cross: 'Cross',
  Check: 'Check',
  Trash: 'Trash',
  Pencil: 'Pencil',
  Expand: 'Expand',
  Collapse: 'Collapse',
  Eye: 'Eye',
  Information: 'Information',
  Plus: 'Plus',
  Minus: 'Minus',
  PaintBrush: 'PaintBrush',
}));

vi.mock('@strapi/strapi/admin', () => ({
  useField: vi.fn(() => ({ value: '', onChange: vi.fn(), error: undefined })),
  useFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() })),
}));

import { FULL_PRESET_CONFIG, MINIMAL_PRESET_CONFIG, BUILT_IN_PRESETS } from '../../shared/types';
import { buildExtensions } from '../../admin/src/utils/buildExtensions';
import { calculateReadingTimeMinutes } from '../../admin/src/components/EditorFooterAndModes';
import { slugifyHeadingText } from '../../admin/src/extensions/Heading';
import { normalizeVideoEmbedUrl } from '../../admin/src/extensions/Video';
import { parseJSONContent } from '../../admin/src/utils/tiptapUtils';
import { jsonToMarkdown } from '../../shared/contentSerializer';

describe('admin/extensions & utilities', () => {
  describe('buildExtensions with all 48 features & Zero-Data-Loss fallback', () => {
    it('builds extensions for FULL_PRESET_CONFIG and edifice preset without errors', () => {
      const fullExtensions = buildExtensions(FULL_PRESET_CONFIG) as Array<{ name?: string }>;
      expect(Array.isArray(fullExtensions)).toBe(true);
      expect(fullExtensions.length).toBeGreaterThan(25);
      const fullNames = fullExtensions.map((ext) => ext?.name).filter(Boolean);
      expect(fullNames).toContain('details');
      expect(fullNames).toContain('conversationHistory');
      expect(fullNames).toContain('layoutContainer');
      expect(fullNames).toContain('taskList');
      expect(fullNames).toContain('pageBreak');
      expect(fullNames).toContain('tableOfContents');
      expect(fullNames).toContain('leadParagraph');
      expect(fullNames).toContain('abbr');
      expect(fullNames).toContain('language');
      expect(fullNames).toContain('characterCount');

      const edificeExtensions = buildExtensions(BUILT_IN_PRESETS.edifice);
      expect(edificeExtensions.length).toBe(fullExtensions.length);
    });

    it('registers read-only NodeView extensions and schema-preserving nodes/marks even in MINIMAL_PRESET_CONFIG (Zero-Data-Loss)', () => {
      const minimalExtensions = buildExtensions(MINIMAL_PRESET_CONFIG) as Array<{ name?: string }>;
      const names = minimalExtensions.map((ext) => ext?.name).filter(Boolean);

      expect(names).toContain('image');
      expect(names).toContain('video');
      expect(names).toContain('audio');
      expect(names).toContain('attachment');
      expect(names).toContain('iframe');
      expect(names).toContain('linker');
      expect(names).toContain('informationPane');
      expect(names).toContain('mathematics');
      expect(names).toContain('leadParagraph');
      expect(names).toContain('language');
      expect(names).toContain('abbr');
      expect(names).toContain('details');
      expect(names).toContain('detailsSummary');
      expect(names).toContain('detailsContent');
      expect(names).toContain('conversationHistory');
      expect(names).toContain('layoutContainer');
      expect(names).toContain('layoutColumn');
      expect(names).toContain('taskList');
      expect(names).toContain('taskItem');
      expect(names).toContain('pageBreak');
      expect(names).toContain('tableOfContents');
      expect(names).toContain('characterCount');
    });

    it('omits characterCount when explicitly disabled with characterCount: false and no characterLimit', () => {
      const extensions = buildExtensions({ ...MINIMAL_PRESET_CONFIG, characterCount: false }) as Array<{
        name?: string;
      }>;
      const names = extensions.map((ext) => ext?.name).filter(Boolean);
      expect(names).not.toContain('characterCount');
    });
  });

  describe('calculateReadingTimeMinutes', () => {
    it('returns 0 minutes when wordCount is 0 or negative', () => {
      expect(calculateReadingTimeMinutes(0)).toBe(0);
      expect(calculateReadingTimeMinutes(-10)).toBe(0);
    });

    it('calculates reading time at 200 WPM by default and rounds up to at least 1 minute', () => {
      expect(calculateReadingTimeMinutes(1)).toBe(1);
      expect(calculateReadingTimeMinutes(200)).toBe(1);
      expect(calculateReadingTimeMinutes(201)).toBe(2);
      expect(calculateReadingTimeMinutes(450)).toBe(3);
    });

    it('supports custom wordsPerMinute and falls back to 200 WPM when invalid', () => {
      expect(calculateReadingTimeMinutes(300, 150)).toBe(2);
      expect(calculateReadingTimeMinutes(300, 0)).toBe(2);
    });
  });

  describe('normalizeVideoEmbedUrl', () => {
    it('normalizes YouTube watch and short URLs to embed URLs', () => {
      expect(normalizeVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'embed',
      });
      expect(normalizeVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'embed',
      });
    });

    it('normalizes Vimeo URLs to player.vimeo.com', () => {
      expect(normalizeVideoEmbedUrl('https://vimeo.com/123456789')).toEqual({
        src: 'https://player.vimeo.com/video/123456789',
        embedType: 'embed',
      });
    });

    it('preserves direct video URLs and rejects unsafe schemes', () => {
      expect(normalizeVideoEmbedUrl('https://cdn.example.com/video.mp4')).toEqual({
        src: 'https://cdn.example.com/video.mp4',
        embedType: 'file',
      });
      expect(normalizeVideoEmbedUrl('javascript:alert(1)')).toBeNull();
    });
  });

  describe('slugifyHeadingText', () => {
    it('preserves Unicode letters and numbers while stripping diacritics and punctuation', () => {
      expect(slugifyHeadingText('Café & Résumé!')).toBe('cafe-resume');
      expect(slugifyHeadingText('日本語の見出し 2026')).toBe('日本語の見出し-2026');
      expect(slugifyHeadingText('Заголовок раздела')).toBe('заголовок-раздела');
    });
  });

  describe('parseJSONContent multi-format parser', () => {
    it('parses JSON strings, HTML strings, and Markdown strings cleanly', () => {
      const jsonDoc = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'JSON doc' }] }],
      });
      expect(parseJSONContent(jsonDoc, '', 'json')).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'JSON doc' }] }],
      });

      const htmlInput = '<p onclick="evil()">Safe HTML</p>';
      expect(parseJSONContent(htmlInput, '', 'html')).toBe('<p>Safe HTML</p>');

      const mdInput = '# Heading 1\n\nParagraph text';
      const parsedMd = parseJSONContent(mdInput, '', 'markdown') as { type: string; content: any[] };
      expect(parsedMd.type).toBe('doc');
      expect(parsedMd.content[0].type).toBe('heading');
    });

    it('parses Markdown documents starting with <details> and ending with a metadata comment as a doc object', () => {
      const docStartingWithDetailsAndEndingWithAlignedParagraph = {
        type: 'doc',
        content: [
          {
            type: 'details',
            attrs: { open: true },
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text: 'FAQ' }] },
              {
                type: 'detailsContent',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Answer' }] }],
              },
            ],
          },
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: 'Centered conclusion' }],
          },
        ],
      };

      const serializedMd = jsonToMarkdown(docStartingWithDetailsAndEndingWithAlignedParagraph);
      expect(serializedMd.startsWith('<')).toBe(true);
      expect(serializedMd.endsWith('>')).toBe(true);

      const parsed = parseJSONContent(serializedMd, '', 'markdown');
      expect(typeof parsed).toBe('object');
      expect(parsed).toEqual(docStartingWithDetailsAndEndingWithAlignedParagraph);
    });

    it('does not treat arbitrary JSON snippets as ProseMirror docs when outputFormat is markdown or html', () => {
      const mdParsed = parseJSONContent('{"hello":"world"}', '<p></p>', 'markdown') as {
        type: string;
        content: any[];
      };
      expect(mdParsed.type).toBe('doc');
      expect(mdParsed.content[0].type).toBe('paragraph');

      const htmlParsed = parseJSONContent('{"hello":"world"}', '<p></p>', 'html');
      expect(htmlParsed).toBe('{"hello":"world"}');
    });
  });
});
