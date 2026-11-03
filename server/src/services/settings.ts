import type { Core } from '@strapi/strapi';
import {
  DEFAULT_RUNTIME_SETTINGS,
  PRESET_FEATURE_KEYS,
  TiptapOutputFormat,
  TiptapPresetConfig,
  TiptapRuntimeSettings,
} from '../../../shared/src/types';
import {
  isReservedNodeName,
  isValidComponentName,
} from '../../../shared/src/components/names';
import { SETTINGS_STORE_KEY } from '../bootstrap';

const VALID_OUTPUT_FORMATS = new Set<TiptapOutputFormat>(['json', 'html', 'markdown']);
const VALID_FEATURE_KEYS = new Set<string>([...PRESET_FEATURE_KEYS, 'customExtensions']);

const RESERVED_OBJECT_KEYS = new Set<string>([
  '__proto__',
  'prototype',
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

/**
 * Checks whether an object key is a reserved prototype or Object.prototype property name.
 */
export const isReservedObjectKey = (key: string): boolean => RESERVED_OBJECT_KEYS.has(key);

/**
 * Error thrown when runtime settings payload validation fails.
 */
export class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
}

/**
 * Checks whether a value is a non-null plain object.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const assertNoReservedKeysDeep = (value: unknown, contextPath: string): void => {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertNoReservedKeysDeep(value[i], `${contextPath}[${i}]`);
    }
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (isReservedObjectKey(key)) {
      throw new SettingsValidationError(`Disallowed reserved key "${key}" in ${contextPath}`);
    }
    assertNoReservedKeysDeep(value[key], `${contextPath}.${key}`);
  }
};

/**
 * Creates the Tiptap runtime settings service backed by Strapi core-store.
 */
const createSettingsService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Returns the plugin-scoped Strapi core-store instance if available.
   */
  getStore() {
    if (typeof strapi?.store !== 'function') return null;
    return strapi.store({
      type: 'plugin',
      name: 'tiptap-editor',
    });
  },

  /**
   * Retrieves merged runtime settings (defaults + config/plugins.ts + core-store).
   */
  async getSettings(): Promise<Required<TiptapRuntimeSettings>> {
    const configSettings =
      (strapi?.config?.get?.('plugin::tiptap-editor.settings', {}) as TiptapRuntimeSettings) || {};
    const store = this.getStore();
    let stored: TiptapRuntimeSettings | null = null;
    if (store) {
      try {
        stored = (await store.get({ key: SETTINGS_STORE_KEY })) as TiptapRuntimeSettings | null;
      } catch {
        stored = null;
      }
    }

    return {
      ...DEFAULT_RUNTIME_SETTINGS,
      ...(isPlainObject(configSettings) ? configSettings : {}),
      ...(stored && isPlainObject(stored) ? stored : {}),
    };
  },

  /**
   * Validates and persists updated runtime settings in Strapi core-store.
   */
  async updateSettings(input: unknown): Promise<Required<TiptapRuntimeSettings>> {
    if (!isPlainObject(input)) {
      throw new SettingsValidationError('Settings payload must be a plain object');
    }

    for (const topKey of Object.keys(input)) {
      if (isReservedObjectKey(topKey)) {
        throw new SettingsValidationError(`Disallowed reserved key "${topKey}" in settings payload`);
      }
    }

    const configSettings =
      (strapi?.config?.get?.('plugin::tiptap-editor.settings', {}) as TiptapRuntimeSettings) || {};
    const baseSettings: Required<TiptapRuntimeSettings> = {
      ...DEFAULT_RUNTIME_SETTINGS,
      ...(isPlainObject(configSettings) ? configSettings : {}),
    };

    const store = this.getStore();
    let existingStored: TiptapRuntimeSettings | null = null;
    if (store) {
      try {
        existingStored = (await store.get({
          key: SETTINGS_STORE_KEY,
        })) as TiptapRuntimeSettings | null;
      } catch {
        existingStored = null;
      }
    }

    const storedOverrides: TiptapRuntimeSettings =
      existingStored && isPlainObject(existingStored) ? { ...existingStored } : {};

    if (input.defaultPreset !== undefined) {
      if (
        typeof input.defaultPreset !== 'string' ||
        !/^[\w-]+$/.test(input.defaultPreset.trim()) ||
        isReservedObjectKey(input.defaultPreset.trim())
      ) {
        throw new SettingsValidationError('Invalid defaultPreset value');
      }
      const nextPreset = input.defaultPreset.trim();
      if (nextPreset === baseSettings.defaultPreset) {
        delete storedOverrides.defaultPreset;
      } else {
        storedOverrides.defaultPreset = nextPreset;
      }
    }

    if (input.defaultOutputFormat !== undefined) {
      if (
        typeof input.defaultOutputFormat !== 'string' ||
        !VALID_OUTPUT_FORMATS.has(input.defaultOutputFormat as TiptapOutputFormat)
      ) {
        throw new SettingsValidationError(
          'Invalid defaultOutputFormat value. Must be json, html, or markdown'
        );
      }
      const nextFormat = input.defaultOutputFormat as TiptapOutputFormat;
      if (nextFormat === baseSettings.defaultOutputFormat) {
        delete storedOverrides.defaultOutputFormat;
      } else {
        storedOverrides.defaultOutputFormat = nextFormat;
      }
    }

    if (input.enableRelationalSync !== undefined) {
      if (typeof input.enableRelationalSync !== 'boolean') {
        throw new SettingsValidationError('enableRelationalSync must be a boolean');
      }
      if (input.enableRelationalSync === baseSettings.enableRelationalSync) {
        delete storedOverrides.enableRelationalSync;
      } else {
        storedOverrides.enableRelationalSync = input.enableRelationalSync;
      }
    }

    if (input.allowedIframeDomains !== undefined) {
      if (
        !Array.isArray(input.allowedIframeDomains) ||
        !input.allowedIframeDomains.every(
          (d) => typeof d === 'string' && /^[a-zA-Z0-9.-]+$/.test(d.trim())
        )
      ) {
        throw new SettingsValidationError(
          'allowedIframeDomains must be an array of valid domain names'
        );
      }
      const nextDomains = input.allowedIframeDomains.map((d) => d.trim().toLowerCase());
      if (JSON.stringify(nextDomains) === JSON.stringify(baseSettings.allowedIframeDomains)) {
        delete storedOverrides.allowedIframeDomains;
      } else {
        storedOverrides.allowedIframeDomains = nextDomains;
      }
    }

    if (input.presetOverrides !== undefined) {
      if (!isPlainObject(input.presetOverrides)) {
        throw new SettingsValidationError('presetOverrides must be a plain object');
      }
      const sanitizedOverrides: Record<string, Partial<TiptapPresetConfig>> = {};
      for (const [presetName, override] of Object.entries(input.presetOverrides)) {
        if (
          isReservedObjectKey(presetName) ||
          !/^[\w-]+$/.test(presetName) ||
          !isPlainObject(override)
        ) {
          throw new SettingsValidationError(`Invalid preset override for "${presetName}"`);
        }
        const cleanPreset: Partial<TiptapPresetConfig> = {};
        for (const [fKey, fVal] of Object.entries(override)) {
          if (isReservedObjectKey(fKey)) {
            throw new SettingsValidationError(
              `Disallowed reserved key "${fKey}" in presetOverrides.${presetName}`
            );
          }
          if (!VALID_FEATURE_KEYS.has(fKey)) {
            throw new SettingsValidationError(
              `Unknown feature key "${fKey}" in presetOverrides.${presetName}`
            );
          }
          if (fKey === 'components') {
            if (!isPlainObject(fVal)) {
              throw new SettingsValidationError(
                `Invalid value for "components" in presetOverrides.${presetName}: must be a plain object`
              );
            }
            for (const [compName, compVal] of Object.entries(fVal)) {
              if (
                isReservedObjectKey(compName) ||
                isReservedNodeName(compName) ||
                !isValidComponentName(compName)
              ) {
                throw new SettingsValidationError(
                  `Invalid or reserved component name "${compName}" in presetOverrides.${presetName}.components`
                );
              }
              if (typeof compVal !== 'boolean' && !isPlainObject(compVal)) {
                throw new SettingsValidationError(
                  `Invalid value for component "${compName}" in presetOverrides.${presetName}.components`
                );
              }
              assertNoReservedKeysDeep(
                compVal,
                `presetOverrides.${presetName}.components.${compName}`
              );
            }
          } else if (fKey === 'customExtensions') {
            if (!isPlainObject(fVal)) {
              throw new SettingsValidationError(
                `Invalid value for "customExtensions" in presetOverrides.${presetName}: must be a plain object`
              );
            }
            for (const [extName, extVal] of Object.entries(fVal)) {
              if (isReservedObjectKey(extName) || !/^[\w-]+$/.test(extName)) {
                throw new SettingsValidationError(
                  `Invalid or reserved customExtension name "${extName}" in presetOverrides.${presetName}.customExtensions`
                );
              }
              if (typeof extVal !== 'boolean' && !isPlainObject(extVal)) {
                throw new SettingsValidationError(
                  `Invalid value for customExtension "${extName}" in presetOverrides.${presetName}.customExtensions`
                );
              }
              assertNoReservedKeysDeep(
                extVal,
                `presetOverrides.${presetName}.customExtensions.${extName}`
              );
            }
          } else if (typeof fVal !== 'boolean' && !isPlainObject(fVal)) {
            throw new SettingsValidationError(
              `Invalid value for "${fKey}" in presetOverrides.${presetName}`
            );
          } else if (isPlainObject(fVal)) {
            assertNoReservedKeysDeep(fVal, `presetOverrides.${presetName}.${fKey}`);

            if (fKey === 'link') {
              for (const disallowedLinkKey of ['protocols', 'isAllowedUri', 'validate'] as const) {
                if (Object.prototype.hasOwnProperty.call(fVal, disallowedLinkKey)) {
                  throw new SettingsValidationError(
                    `Disallowed option "${disallowedLinkKey}" in presetOverrides.${presetName}.link`
                  );
                }
              }
              if (Object.prototype.hasOwnProperty.call(fVal, 'HTMLAttributes') && fVal.HTMLAttributes !== undefined) {
                if (!isPlainObject(fVal.HTMLAttributes)) {
                  throw new SettingsValidationError(
                    `Invalid HTMLAttributes in presetOverrides.${presetName}.link: must be a plain object`
                  );
                }
                for (const attrKey of Object.keys(fVal.HTMLAttributes)) {
                  if (isReservedObjectKey(attrKey) || /^on/i.test(attrKey.trim())) {
                    throw new SettingsValidationError(
                      `Disallowed event handler or reserved attribute "${attrKey}" in presetOverrides.${presetName}.link.HTMLAttributes`
                    );
                  }
                }
              }
            }

            if (fKey === 'mediaLibrary') {
              if (fVal.allowBase64 !== undefined && fVal.allowBase64 !== false) {
                throw new SettingsValidationError(
                  `Disallowed option "allowBase64" in presetOverrides.${presetName}.mediaLibrary`
                );
              }
            }

            if (fKey === 'iframe' && fVal.allowedDomains !== undefined) {
              if (
                !Array.isArray(fVal.allowedDomains) ||
                !fVal.allowedDomains.every(
                  (d) => typeof d === 'string' && /^[a-zA-Z0-9.-]+$/.test(d.trim())
                )
              ) {
                throw new SettingsValidationError(
                  `Invalid allowedDomains in presetOverrides.${presetName}.iframe: must be an array of valid domain names`
                );
              }
            }
          }

          (cleanPreset as Record<string, unknown>)[fKey] =
            fKey === 'iframe' && isPlainObject(fVal) && Array.isArray(fVal.allowedDomains)
              ? {
                  ...fVal,
                  allowedDomains: fVal.allowedDomains.map((d: string) => d.trim().toLowerCase()),
                }
              : fVal;
        }
        sanitizedOverrides[presetName] = cleanPreset;
      }
      if (JSON.stringify(sanitizedOverrides) === JSON.stringify(baseSettings.presetOverrides)) {
        delete storedOverrides.presetOverrides;
      } else {
        storedOverrides.presetOverrides = sanitizedOverrides;
      }
    }

    if (store) {
      await store.set({
        key: SETTINGS_STORE_KEY,
        value: storedOverrides,
      });
    }

    return {
      ...baseSettings,
      ...storedOverrides,
    };
  },
});

export default createSettingsService;
