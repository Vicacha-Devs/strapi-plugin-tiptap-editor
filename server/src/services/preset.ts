import type { Core } from '@strapi/strapi';
import {
  BUILT_IN_PRESETS,
  TiptapPluginConfig,
  TiptapPresetConfig,
} from '../../../shared/types';

const DEFAULT_CONFIG: TiptapPluginConfig = { presets: {} };

const createPresetService = ({ strapi }: { strapi: Core.Strapi }) => ({
  getConfig(): TiptapPluginConfig {
    return strapi.config.get('plugin::tiptap-editor', DEFAULT_CONFIG) as TiptapPluginConfig;
  },

  listPresetNames(): string[] {
    return Object.keys(this.getConfig().presets || {});
  },

  listAvailablePresets(): string[] {
    const configured = Object.keys(this.getConfig().presets || {});
    const builtIn = Object.keys(BUILT_IN_PRESETS);
    return Array.from(new Set([...configured, ...builtIn]));
  },

  getPreset(name: string): TiptapPresetConfig | null {
    const presets = this.getConfig().presets || {};
    return presets[name] ?? null;
  },

  async getEffectivePreset(name: string): Promise<TiptapPresetConfig | null> {
    const presets = this.getConfig().presets || {};
    const basePreset = presets[name] ?? BUILT_IN_PRESETS[name] ?? null;
    if (!basePreset) return null;

    try {
      const settingsService = strapi.plugin?.('tiptap-editor')?.service?.('settings') as
        | { getSettings?: () => Promise<{ presetOverrides?: Record<string, Partial<TiptapPresetConfig>> }> }
        | undefined;
      if (settingsService && typeof settingsService.getSettings === 'function') {
        const runtime = await settingsService.getSettings();
        const override = runtime?.presetOverrides?.[name];
        if (override && typeof override === 'object') {
          return { ...basePreset, ...override };
        }
      }
    } catch {
      // Ignore runtime store lookup failure and return base preset
    }

    return basePreset;
  },
});

export default createPresetService;
