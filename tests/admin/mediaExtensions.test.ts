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


vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: (init: any) => ({ current: init }),
    useEffect: (fn: () => void) => {
      fn();
    },
    useCallback: (fn: any) => fn,
  };
});

vi.mock('@strapi/strapi/admin', () => ({
  useField: vi.fn(() => ({ value: '', onChange: vi.fn(), error: undefined })),
  useFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() })),
  getFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn() })),
}));

import { buildExtensions } from '../../admin/src/utils/buildExtensions';
import { normalizeVideoEmbedUrl } from '../../admin/src/extensions/Video';
import { isSafeUrl, isSafeIframeUrl } from '../../shared/urlSafety';

describe('media & embed extensions', () => {
  describe('buildExtensions zero-data-loss media nodes', () => {
    const names = (config: Record<string, unknown>) =>
      buildExtensions(config as any).map((ext: any) => ext.name);

    it('always registers video, audio, attachment, iframe and linker schemas', () => {
      const registered = names({ bold: true });
      for (const name of ['video', 'audio', 'attachment', 'iframe', 'linker']) {
        expect(registered).toContain(name);
      }
    });

    it('registers the same schemas when the features are enabled', () => {
      const registered = names({
        video: true,
        audio: true,
        attachment: true,
        iframe: { allowedDomains: ['example.com'] },
        linker: true,
      });
      for (const name of ['video', 'audio', 'attachment', 'iframe', 'linker']) {
        expect(registered).toContain(name);
      }
    });

    it('adds the strapi protocol to links unless allowInternalLinks is false', () => {
      expect(() => buildExtensions({ link: true } as any)).not.toThrow();
      expect(() => buildExtensions({ link: { allowInternalLinks: false } } as any)).not.toThrow();
    });
  });

  describe('url safety helpers', () => {
    it('accepts safe URLs and strapi:// links, rejects script schemes', () => {
      expect(isSafeUrl('https://example.com/a.png')).toBe(true);
      expect(isSafeUrl('strapi://api::article.article/doc-1')).toBe(true);
      expect(isSafeUrl('/relative/path')).toBe(true);
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('java&#x09;script:alert(1)')).toBe(false);
      expect(isSafeUrl('//evil.example.com')).toBe(false);
    });

    it('requires https and honours the iframe domain allowlist', () => {
      expect(isSafeIframeUrl('https://maps.example.com/embed')).toBe(true);
      expect(isSafeIframeUrl('http://maps.example.com/embed')).toBe(false);
      expect(isSafeIframeUrl('https://maps.example.com/x', ['example.com'])).toBe(true);
      expect(isSafeIframeUrl('https://evil.com/x', ['example.com'])).toBe(false);
    });
  });

  describe('normalizeVideoEmbedUrl', () => {
    it('normalizes YouTube watch, short, shorts, and live URLs to embed URLs and rejects unrecognized YouTube URLs', () => {
      expect(normalizeVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'embed',
      });
      expect(normalizeVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'embed',
      });
      expect(normalizeVideoEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'embed',
      });
      expect(normalizeVideoEmbedUrl('https://www.youtube.com/live/dQw4w9WgXcQ')).toEqual({
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        embedType: 'embed',
      });
      expect(normalizeVideoEmbedUrl('https://www.youtube.com/channel/UC12345')).toBeNull();
      expect(normalizeVideoEmbedUrl('https://youtu.be/')).toBeNull();
    });

    it('normalizes Vimeo URLs to player.vimeo.com and rejects Vimeo URLs without a numeric video ID', () => {
      expect(normalizeVideoEmbedUrl('https://vimeo.com/123456789')).toEqual({
        src: 'https://player.vimeo.com/video/123456789',
        embedType: 'embed',
      });
      expect(normalizeVideoEmbedUrl('https://vimeo.com/channels/staffpicks')).toBeNull();
    });

    it('preserves direct video URLs and rejects unsafe schemes', () => {
      expect(normalizeVideoEmbedUrl('https://cdn.example.com/video.mp4')).toEqual({
        src: 'https://cdn.example.com/video.mp4',
        embedType: 'file',
      });
      expect(normalizeVideoEmbedUrl('javascript:alert(1)')).toBeNull();
    });
  });

  describe('StrapiVideo embed host allowlist', () => {
    it('enforces YouTube/Vimeo embed host allowlist when embedType is embed in renderHTML', async () => {
      const { StrapiVideo } = await import('../../admin/src/extensions/Video');
      const renderHTML = (StrapiVideo as any).config.renderHTML.bind(StrapiVideo);

      const safeYouTube = renderHTML({
        HTMLAttributes: {
          src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
          embedType: 'embed',
          title: 'Video',
        },
      });
      expect(safeYouTube[0]).toBe('iframe');
      expect(safeYouTube[1].src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');

      const unsafeEmbedHost = renderHTML({
        HTMLAttributes: {
          src: 'https://evil.example.com/embed/123',
          embedType: 'embed',
          title: 'Untrusted',
        },
      });
      expect(unsafeEmbedHost[0]).toBe('iframe');
      expect(unsafeEmbedHost[1].src).toBe('');
    });
  });
});
