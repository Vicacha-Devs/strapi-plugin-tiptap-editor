import type { Core } from '@strapi/strapi';
import {
  BUILT_IN_PRESETS,
  TiptapPluginConfig,
  TiptapPresetConfig,
} from '../../../shared/src/types';
import { isReservedObjectKey } from './settings';

const DEFAULT_CONFIG: TiptapPluginConfig = { presets: {} };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const mergePlainObjects = (
  baseObj: Record<string, unknown>,
  overrideObj: Record<string, unknown>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(baseObj)) {
    if (!isReservedObjectKey(k)) {
      result[k] = v;
    }
  }
  for (const [k, v] of Object.entries(overrideObj)) {
    if (isReservedObjectKey(k) || v === undefined) continue;
    const prev = result[k];
    if (isPlainObject(prev) && isPlainObject(v)) {
      result[k] = mergePlainObjects(prev, v);
    } else {
      result[k] = v;
    }
  }
  return result;
};

/**
 * Creates the preset configuration service for resolving built-in, file-configured,
 * and runtime-overridden Tiptap editor presets.
 */
const createPresetService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Returns the raw plugin configuration from Strapi config.
   */
  getConfig(): TiptapPluginConfig {
    return strapi.config.get('plugin::tiptap-editor', DEFAULT_CONFIG) as TiptapPluginConfig;
  },

  /**
   * Lists preset names explicitly defined in the plugin configuration file.
   */
  listPresetNames(): string[] {
    return Object.keys(this.getConfig().presets || {}).filter((k) => !isReservedObjectKey(k));
  },

  /**
   * Lists all available preset names combining custom presets and built-in presets.
   */
  listAvailablePresets(): string[] {
    const configured = Object.keys(this.getConfig().presets || {}).filter(
      (k) => !isReservedObjectKey(k)
    );
    const builtIn = Object.keys(BUILT_IN_PRESETS);
    return Array.from(new Set([...configured, ...builtIn]));
  },

  /**
   * Returns a file-configured preset by name, or `null` if not found.
   */
  getPreset(name: string): TiptapPresetConfig | null {
    if (isReservedObjectKey(name)) return null;
    const presets = this.getConfig().presets || {};
    return Object.prototype.hasOwnProperty.call(presets, name) ? presets[name] : null;
  },

  /**
   * Returns a file-configured preset or built-in preset by name without runtime overrides, or `null` if not found.
   */
  getRawPresetOrBuiltIn(name: string): TiptapPresetConfig | null {
    if (isReservedObjectKey(name)) return null;
    const presets = this.getConfig().presets || {};
    if (Object.prototype.hasOwnProperty.call(presets, name)) {
      return presets[name];
    }
    if (Object.prototype.hasOwnProperty.call(BUILT_IN_PRESETS, name)) {
      return BUILT_IN_PRESETS[name];
    }
    return null;
  },

  /**
   * Resolves the effective preset configuration by merging the base preset
   * with runtime overrides and `allowedIframeDomains` from the Strapi core-store.
   */
  async getEffectivePreset(name: string): Promise<TiptapPresetConfig | null> {
    const basePreset = this.getRawPresetOrBuiltIn(name);
    if (!basePreset) return null;

    try {
      const settingsService = strapi.plugin?.('tiptap-editor')?.service?.('settings') as
        | {
            getSettings?: () => Promise<{
              presetOverrides?: Record<string, Partial<TiptapPresetConfig>>;
              allowedIframeDomains?: string[];
            }>;
          }
        | undefined;
      if (settingsService && typeof settingsService.getSettings === 'function') {
        const runtime = await settingsService.getSettings();
        const overridesMap = runtime?.presetOverrides;
        const override =
          overridesMap && Object.prototype.hasOwnProperty.call(overridesMap, name)
            ? overridesMap[name]
            : undefined;
        const merged: TiptapPresetConfig = isPlainObject(override)
          ? (mergePlainObjects(
              basePreset as Record<string, unknown>,
              override as Record<string, unknown>
            ) as TiptapPresetConfig)
          : { ...basePreset };

        if (merged.iframe && Array.isArray(runtime?.allowedIframeDomains)) {
          const existingIframeOpts =
            typeof merged.iframe === 'object' && merged.iframe !== null ? merged.iframe : {};
          merged.iframe = {
            ...existingIframeOpts,
            allowedDomains:
              Array.isArray(existingIframeOpts.allowedDomains) &&
              existingIframeOpts.allowedDomains.length > 0
                ? existingIframeOpts.allowedDomains
                : runtime.allowedIframeDomains,
          };
        }

        return merged;
      }
    } catch (error) {
      strapi?.log?.warn?.(
        `[tiptap-editor] Failed to apply runtime settings to preset "${name}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return basePreset;
  },
});

export default createPresetService;
