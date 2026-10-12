import { describe, it, expect, vi } from 'vitest';
import createSettingsService from '../../server/src/services/settings';
import createSearchService from '../../server/src/services/search';
import createMediaService, { isSsrfSafeUrl } from '../../server/src/services/media';
import bootstrap from '../../server/src/bootstrap';

describe('server/services/settings', () => {
  it('returns default runtime settings merged with store values', async () => {
    let storedValue: any = null;
    const mockStore = {
      get: vi.fn(async () => storedValue),
      set: vi.fn(async ({ value }) => {
        storedValue = value;
      }),
    };
    const mockStrapi = {
      config: { get: vi.fn(() => ({})) },
      store: vi.fn(() => mockStore),
    } as any;

    const service = createSettingsService({ strapi: mockStrapi });
    const initial = await service.getSettings();
    expect(initial.defaultPreset).toBe('default');
    expect(initial.defaultOutputFormat).toBe('json');
    expect(initial.enableRelationalSync).toBe(true);

    const updated = await service.updateSettings({
      defaultPreset: 'edifice',
      defaultOutputFormat: 'markdown',
      allowedIframeDomains: ['YouTube.com', 'vimeo.com'],
      presetOverrides: {
        edifice: { bold: true, mathematics: true },
      },
    });
    expect(updated.defaultPreset).toBe('edifice');
    expect(updated.defaultOutputFormat).toBe('markdown');
    expect(updated.allowedIframeDomains).toEqual(['youtube.com', 'vimeo.com']);
    expect(updated.presetOverrides.edifice?.mathematics).toBe(true);
  });

  it('rejects invalid output formats or unknown feature keys', async () => {
    const mockStrapi = {
      config: { get: vi.fn(() => ({})) },
      store: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
    } as any;
    const service = createSettingsService({ strapi: mockStrapi });

    await expect(
      service.updateSettings({ defaultOutputFormat: 'xml' })
    ).rejects.toThrow('Invalid defaultOutputFormat');

    await expect(
      service.updateSettings({
        presetOverrides: { default: { unknownFeatureXYZ: true } },
      })
    ).rejects.toThrow('Unknown feature key');
  });
});

describe('server/services/search', () => {
  const mockStrapi = {
    contentTypes: {
      'api::article.article': {
        kind: 'collectionType',
        info: { pluralName: 'articles' },
        attributes: {
          title: { type: 'string' },
          body: { type: 'richtext' },
        },
      },
    },
    components: {},
    documents: vi.fn(() => ({
      findMany: vi.fn(async () => [
        {
          documentId: 'doc-101',
          id: 1,
          title: 'Getting Started with Tiptap',
          publishedAt: '2026-10-09T00:00:00Z',
          locale: 'en',
        },
      ]),
      findOne: vi.fn(async ({ documentId }: { documentId: string }) =>
        documentId === 'doc-101'
          ? {
              documentId: 'doc-101',
              id: 1,
              title: 'Getting Started with Tiptap',
              publishedAt: null,
              locale: 'en',
            }
          : null
      ),
    })),
  } as any;

  it('identifies collection title field and searches across linkable collections', async () => {
    const service = createSearchService({ strapi: mockStrapi });
    expect(service.identifyCollectionTitleField('api::article.article')).toBe('title');

    const results = await service.search('Tiptap', 'en');
    expect(results['api::article.article']).toHaveLength(1);
    expect(results['api::article.article'][0]).toEqual({
      documentId: 'doc-101',
      id: 1,
      label: 'Getting Started with Tiptap',
      collectionName: 'api::article.article',
      status: 'published',
      locale: 'en',
    });
  });

  it('resolves a single document by collection UID and documentId', async () => {
    const service = createSearchService({ strapi: mockStrapi });
    const doc = await service.getDocument('api::article.article', 'doc-101');
    expect(doc?.label).toBe('Getting Started with Tiptap');
    expect(doc?.status).toBe('draft');
  });

  it('rejects invalid collectionName or documentId formats', async () => {
    const service = createSearchService({ strapi: mockStrapi });
    expect(() => service.identifyCollectionTitleField('invalid-uid')).toThrow(
      'Invalid collectionName format'
    );
    await expect(
      service.getDocument('api::article.article', '../traversal')
    ).rejects.toThrow('Invalid documentId format');
  });

  it('filters out collections that userAbility cannot read', async () => {
    const service = createSearchService({ strapi: mockStrapi });
    const restrictedAbility = {
      cannot: (action: string, subject: string) =>
        action === 'plugin::content-manager.explorer.read' && subject === 'api::article.article',
    };
    const results = await service.search('Tiptap', 'en', restrictedAbility);
    expect(results['api::article.article']).toBeUndefined();
    await expect(
      service.getDocument('api::article.article', 'doc-101', undefined, restrictedAbility)
    ).rejects.toThrow('Forbidden');
  });
});

describe('server/services/media (SSRF Protection & Metadata)', () => {
  it('blocks localhost, private IPs, metadata IPs, IPv4-mapped IPv6, CGNAT, 0.0.0.0, trailing dots, and non-http protocols', () => {
    expect(isSsrfSafeUrl('http://localhost:1337/admin')).toBe(false);
    expect(isSsrfSafeUrl('http://localhost./admin')).toBe(false);
    expect(isSsrfSafeUrl('http://127.0.0.1:8080/secret')).toBe(false);
    expect(isSsrfSafeUrl('http://0.0.0.0:1337/admin')).toBe(false);
    expect(isSsrfSafeUrl('http://100.64.0.1/cgnat')).toBe(false);
    expect(isSsrfSafeUrl('http://[::ffff:127.0.0.1]:1337/')).toBe(false);
    expect(isSsrfSafeUrl('http://[0:0:0:0:0:ffff:7f00:1]/')).toBe(false);
    expect(isSsrfSafeUrl('http://2130706433/')).toBe(false);
    expect(isSsrfSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSsrfSafeUrl('http://10.0.0.1/internal')).toBe(false);
    expect(isSsrfSafeUrl('http://192.168.1.50/router')).toBe(false);
    expect(isSsrfSafeUrl('http://172.16.0.5/cluster')).toBe(false);
    expect(isSsrfSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSsrfSafeUrl('https://user:pass@example.com/image.jpg')).toBe(false);
    expect(isSsrfSafeUrl('https://strapi.io/assets/logo.png')).toBe(true);
  });

  it('validates uploadByUrl, infers MIME types from extension, and rejects SSRF targets', async () => {
    const service = createMediaService({ strapi: {} as any });
    await expect(service.uploadByUrl('http://127.0.0.1/test.jpg')).rejects.toThrow(
      'SSRF safety validation'
    );

    const asset = await service.uploadByUrl(
      'https://cdn.example.com/photos/banner.jpg',
      'Hero Banner'
    );
    expect(asset.name).toBe('banner.jpg');
    expect(asset.url).toBe('https://cdn.example.com/photos/banner.jpg');
    expect(asset.alternativeText).toBe('Hero Banner');
    expect(asset.mime).toBe('image/jpeg');

    const videoAsset = await service.uploadByUrl('https://cdn.example.com/media/clip.mp4');
    expect(videoAsset.mime).toBe('video/mp4');

    const pdfAsset = await service.uploadByUrl('https://cdn.example.com/docs/report.pdf');
    expect(pdfAsset.mime).toBe('application/pdf');
  });
});

describe('server/bootstrap', () => {
  it('initializes settings in core-store and creates links.links component when missing', async () => {
    const mockSet = vi.fn();
    const mockCreateComponent = vi.fn();
    const mockStrapi = {
      store: vi.fn(() => ({
        get: vi.fn(async () => null),
        set: mockSet,
      })),
      components: {},
      plugin: vi.fn(() => ({
        service: vi.fn(() => ({
          createComponent: mockCreateComponent,
        })),
      })),
      log: { info: vi.fn(), warn: vi.fn() },
    } as any;

    await bootstrap({ strapi: mockStrapi });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockCreateComponent).toHaveBeenCalledTimes(1);
  });
});
