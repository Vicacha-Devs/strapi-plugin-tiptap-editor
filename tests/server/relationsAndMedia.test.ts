import dns from 'node:dns';
import fs from 'node:fs';
import { fetch as undiciFetch } from 'undici';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');
  return {
    ...actual,
    fetch: vi.fn((...args: any[]) => (globalThis.fetch as any)(...args)),
  };
});

import createSettingsService from '../../server/src/services/settings';
import createSearchService from '../../server/src/services/search';
import createMediaService, {
  isSsrfSafeUrl,
  assertSafeResolvedHost,
} from '../../server/src/services/media';
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('fails closed on DNS lookup errors and blocks private resolved IPs', async () => {
    vi.spyOn(dns.promises, 'lookup').mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(assertSafeResolvedHost('nonexistent.example.invalid')).rejects.toThrow(
      'Failed to resolve URL host'
    );

    vi.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
      { address: '10.0.0.42', family: 4 },
    ] as any);
    await expect(assertSafeResolvedHost('rebind.example.com')).rejects.toThrow(
      'disallowed private'
    );
  });

  it('validates uploadByUrl, downloads bounded bytes, and persists through Strapi Upload service', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as any);

    const mockBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-length' ? '4' : null),
      },
      arrayBuffer: async () => mockBytes.buffer,
    }) as unknown as Response);

    const capturedUploads: any[] = [];
    const mockUpload = vi.fn(async (payload: any) => {
      expect(fs.existsSync(payload.files.filepath)).toBe(true);
      capturedUploads.push(payload);
      return [
        {
          id: 42,
          documentId: 'asset-doc-42',
          name: payload.data.fileInfo.name,
          url: `/uploads/${payload.data.fileInfo.name}`,
          mime: payload.files.mimetype,
          size: payload.files.size,
          alternativeText: payload.data.fileInfo.alternativeText,
        },
      ];
    });

    const mockStrapi = {
      plugin: vi.fn((name: string) =>
        name === 'upload'
          ? {
              service: vi.fn((svc: string) => (svc === 'upload' ? { upload: mockUpload } : null)),
            }
          : null
      ),
    } as any;

    const service = createMediaService({ strapi: mockStrapi });
    await expect(service.uploadByUrl('http://127.0.0.1/test.jpg')).rejects.toThrow(
      'SSRF safety validation'
    );

    const asset = await service.uploadByUrl(
      'https://cdn.example.com/photos/banner.jpg',
      'Hero Banner'
    );
    const call = vi.mocked(undiciFetch).mock.calls.at(-1)!;
    expect((call[1] as any).dispatcher).toBeDefined();
    expect((call[1] as any).redirect).toBe('manual');
    expect(asset.id).toBe(42);
    expect(asset.documentId).toBe('asset-doc-42');
    expect(asset.name).toBe('banner.jpg');
    expect(asset.url).toBe('/uploads/banner.jpg');
    expect(asset.alternativeText).toBe('Hero Banner');
    expect(asset.mime).toBe('image/jpeg');
    expect(fs.existsSync(capturedUploads[0].files.filepath)).toBe(false);

    const videoAsset = await service.uploadByUrl('https://cdn.example.com/media/clip.mp4');
    expect(videoAsset.mime).toBe('video/mp4');

    const pdfAsset = await service.uploadByUrl('https://cdn.example.com/docs/report.pdf');
    expect(pdfAsset.mime).toBe('application/pdf');

    // Cancels response body and throws clear error on 3xx redirects
    const cancelMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 301,
      body: { cancel: cancelMock },
    } as unknown as Response);
    await expect(
      service.uploadByUrl('https://cdn.example.com/photos/redirect.jpg')
    ).rejects.toThrow('Remote media URL redirects. Provide the final URL.');
    expect(cancelMock).toHaveBeenCalledTimes(1);

    // Propagates failure when Upload service is unavailable
    const brokenService = createMediaService({ strapi: {} as any });
    await expect(
      brokenService.uploadByUrl('https://cdn.example.com/photos/banner.jpg')
    ).rejects.toThrow('Strapi upload service is unavailable');
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
