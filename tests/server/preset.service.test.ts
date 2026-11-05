import { describe, it, expect, vi } from 'vitest';
import services from '../../server/src/services';

const makeStrapi = (presets: Record<string, unknown>) => ({
  config: {
    get: vi.fn().mockReturnValue({ presets }),
  },
  plugin: vi.fn().mockReturnValue(undefined),
});

describe('preset service (SERVER-02, SERVER-03)', () => {
  it('listPresetNames() returns all preset keys', () => {
    const strapi = makeStrapi({ rich: { bold: true }, minimal: { italic: true } }) as any;
    const service = services.preset({ strapi });
    expect(service.listPresetNames()).toEqual(['rich', 'minimal']);
  });

  it('listPresetNames() returns empty array when no presets configured', () => {
    const strapi = makeStrapi({}) as any;
    const service = services.preset({ strapi });
    expect(service.listPresetNames()).toEqual([]);
  });

  it('getPreset() returns config for known name', () => {
    const richConfig = { bold: true, heading: { levels: [2] } };
    const strapi = makeStrapi({ rich: richConfig }) as any;
    const service = services.preset({ strapi });
    expect(service.getPreset('rich')).toStrictEqual(richConfig);
  });

  it('getPreset() and getEffectivePreset() return null for unknown and inherited prototype names', async () => {
    const strapi = makeStrapi({ rich: { bold: true } }) as any;
    const service = services.preset({ strapi });
    expect(service.getPreset('unknown')).toBeNull();
    expect(service.getPreset('constructor')).toBeNull();
    expect(service.getPreset('toString')).toBeNull();
    expect(await service.getEffectivePreset('constructor')).toBeNull();
    expect(await service.getEffectivePreset('toString')).toBeNull();
  });

  it('getEffectivePreset() deep-merges plain-object feature values like components and table without wiping siblings', async () => {
    const strapi = {
      config: {
        get: vi.fn().mockReturnValue({
          presets: {
            rich: {
              bold: true,
              table: { resizable: true, allowCaption: true },
              components: {
                button: true,
                callout: { tones: ['info', 'warning'], dismissible: true },
              },
            },
          },
        }),
      },
      plugin: vi.fn(() => ({
        service: vi.fn(() => ({
          getSettings: vi.fn(async () => ({
            allowedIframeDomains: [],
            presetOverrides: {
              rich: {
                table: { cellBackground: true },
                components: {
                  pricingTable: true,
                  callout: { dismissible: false },
                },
              },
            },
          })),
        })),
      })),
    } as any;

    const service = services.preset({ strapi });
    const effective = await service.getEffectivePreset('rich');
    expect(effective).toEqual({
      bold: true,
      table: { resizable: true, allowCaption: true, cellBackground: true },
      components: {
        button: true,
        callout: { tones: ['info', 'warning'], dismissible: false },
        pricingTable: true,
      },
    });
  });

  it('getEffectivePreset() applies runtime.allowedIframeDomains when iframe.allowedDomains is an empty array', async () => {
    const strapi = {
      config: {
        get: vi.fn().mockReturnValue({
          presets: {
            embedEmpty: {
              iframe: { allowedDomains: [], allowFullscreen: true },
            },
            embedCustom: {
              iframe: { allowedDomains: ['vimeo.com'], allowFullscreen: false },
            },
          },
        }),
      },
      plugin: vi.fn(() => ({
        service: vi.fn(() => ({
          getSettings: vi.fn(async () => ({
            allowedIframeDomains: ['youtube.com', 'loom.com'],
            presetOverrides: {},
          })),
        })),
      })),
    } as any;

    const service = services.preset({ strapi });
    const effectiveEmpty = await service.getEffectivePreset('embedEmpty');
    expect(effectiveEmpty?.iframe).toEqual({
      allowedDomains: ['youtube.com', 'loom.com'],
      allowFullscreen: true,
    });

    const effectiveCustom = await service.getEffectivePreset('embedCustom');
    expect(effectiveCustom?.iframe).toEqual({
      allowedDomains: ['vimeo.com'],
      allowFullscreen: false,
    });
  });
});
