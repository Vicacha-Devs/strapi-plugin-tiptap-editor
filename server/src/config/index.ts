import {
  PRESET_FEATURE_KEYS,
  TiptapPluginConfig,
  TiptapPresetConfig,
} from '../../../shared/src/types';
import {
  COMPONENT_NAME_RE,
  isReservedNodeName,
  isValidComponentName,
} from '../../../shared/src/components/names';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

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

const isReservedObjectKey = (key: string): boolean => RESERVED_OBJECT_KEYS.has(key);

const TOP_LEVEL_KEYS = new Set<string>(['presets', 'theme', 'settings', 'fieldBindings']);

const FEATURE_KEYS = new Set<string>([...PRESET_FEATURE_KEYS, 'customExtensions']);

const THEME_KEYS = new Set<string>(['colors', 'css', 'stylesheet']);

const FIELD_BINDING_KEYS = new Set<string>(['uid', 'field', 'preset']);

const COLOR_VALUE_RE =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg+-]+\)|var\(--[a-zA-Z0-9_-]+\))$/;

const isValidColorValue = (value: string): boolean => COLOR_VALUE_RE.test(value.trim());

const isValidStylesheetHref = (stylesheet: string): boolean => {
  if (!stylesheet || /[\s<>"'`\u0000-\u001f]/.test(stylesheet)) {
    return false;
  }
  if (stylesheet.startsWith('/')) {
    return !stylesheet.startsWith('//') && !stylesheet.startsWith('/\\');
  }
  if (stylesheet.startsWith('https://')) {
    try {
      const parsed = new URL(stylesheet);
      return (
        parsed.protocol === 'https:' &&
        Boolean(parsed.hostname) &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }
  return false;
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
      throw new Error(`tiptap-editor ${contextPath} contains disallowed reserved key: "${key}"`);
    }
    assertNoReservedKeysDeep(value[key], `${contextPath}.${key}`);
  }
};

const getInvalidKeys = (presetConfig: unknown): string[] => {
  if (!isPlainObject(presetConfig)) return [];
  return Object.keys(presetConfig).filter((key) => !FEATURE_KEYS.has(key));
};

const validateComponents = (presetName: string, components: unknown): void => {
  if (components === undefined) return;
  if (!isPlainObject(components)) {
    throw new Error(`tiptap-editor config.presets.${presetName}.components must be a plain object`);
  }
  for (const [name, value] of Object.entries(components)) {
    if (isReservedObjectKey(name)) {
      throw new Error(
        `tiptap-editor config.presets.${presetName}.components: "${name}" is a reserved key`
      );
    }
    if (isReservedNodeName(name)) {
      throw new Error(
        `tiptap-editor config.presets.${presetName}.components: "${name}" is a reserved node name`
      );
    }
    if (!isValidComponentName(name)) {
      throw new Error(
        `tiptap-editor config.presets.${presetName}.components has invalid component name "${name}". ` +
          `Names must match ${COMPONENT_NAME_RE}`
      );
    }
    if (typeof value !== 'boolean' && !isPlainObject(value)) {
      throw new Error(
        `tiptap-editor config.presets.${presetName}.components.${name} must be a boolean or a plain object`
      );
    }
    assertNoReservedKeysDeep(value, `config.presets.${presetName}.components.${name}`);
  }
};

const config = {
  default: {
    presets: {} as Record<string, TiptapPresetConfig>,
  },
  validator(pluginConfig: unknown): void {
    if (!isPlainObject(pluginConfig)) {
      throw new Error('tiptap-editor plugin config must be a plain object');
    }

    for (const key of Object.keys(pluginConfig)) {
      if (isReservedObjectKey(key)) {
        throw new Error(`tiptap-editor config contains disallowed reserved key: "${key}"`);
      }
      if (!TOP_LEVEL_KEYS.has(key)) {
        throw new Error(
          `tiptap-editor config has unknown key: "${key}". Allowed keys: presets, theme, settings, fieldBindings`
        );
      }
    }

    const typedConfig = pluginConfig as {
      presets?: unknown;
      theme?: unknown;
      settings?: unknown;
      fieldBindings?: unknown;
    };
    const { presets, theme, settings, fieldBindings } = typedConfig;

    if (presets !== undefined) {
      if (!isPlainObject(presets)) {
        throw new Error('tiptap-editor config.presets must be a plain object');
      }

      const allInvalidKeys: string[] = [];
      for (const [presetName, presetConfig] of Object.entries(
        presets as Record<string, unknown>
      )) {
        if (isReservedObjectKey(presetName)) {
          throw new Error(`tiptap-editor config.presets: "${presetName}" is a reserved key`);
        }
        if (!isPlainObject(presetConfig)) {
          throw new Error(
            `tiptap-editor config.presets.${presetName} must be a plain object, got ${typeof presetConfig}`
          );
        }
        for (const fKey of Object.keys(presetConfig)) {
          if (isReservedObjectKey(fKey)) {
            throw new Error(
              `tiptap-editor config.presets.${presetName} contains disallowed reserved key: "${fKey}"`
            );
          }
        }
        validateComponents(presetName, (presetConfig as Record<string, unknown>).components);
        const invalidKeys = getInvalidKeys(presetConfig);
        if (invalidKeys.length > 0) {
          allInvalidKeys.push(...invalidKeys);
        }
      }

      if (allInvalidKeys.length > 0) {
        throw new Error(
          `tiptap-editor config.presets contains invalid feature keys: ${allInvalidKeys.join(', ')}. ` +
            `Allowed keys: ${PRESET_FEATURE_KEYS.join(', ')}`
        );
      }
    }

    if (theme !== undefined) {
      if (!isPlainObject(theme)) {
        throw new Error('tiptap-editor config.theme must be a plain object');
      }

      for (const key of Object.keys(theme)) {
        if (isReservedObjectKey(key)) {
          throw new Error(`tiptap-editor config.theme contains disallowed reserved key: "${key}"`);
        }
        if (!THEME_KEYS.has(key)) {
          throw new Error(
            `tiptap-editor config.theme has unknown key: "${key}". Allowed keys: colors, stylesheet`
          );
        }
      }

      const { stylesheet, css, colors } = theme as {
        stylesheet?: unknown;
        css?: unknown;
        colors?: unknown;
      };

      if (stylesheet !== undefined) {
        if (typeof stylesheet !== 'string') {
          throw new Error('tiptap-editor config.theme.stylesheet must be a string');
        }
        if (!isValidStylesheetHref(stylesheet)) {
          throw new Error(
            `tiptap-editor config.theme.stylesheet must be a valid "https://" URL or single-slash relative path ("/..."), got "${stylesheet}"`
          );
        }
      }

      if (css !== undefined && typeof css !== 'string') {
        throw new Error('tiptap-editor config.theme.css must be a string');
      }

      if (stylesheet !== undefined && css !== undefined) {
        throw new Error(
          'tiptap-editor config.theme: provide either "stylesheet" or "css", not both'
        );
      }

      if (colors !== undefined) {
        if (!Array.isArray(colors)) {
          throw new Error('tiptap-editor config.theme.colors must be an array');
        }

        for (let i = 0; i < colors.length; i++) {
          const entry = colors[i];

          if (!isPlainObject(entry)) {
            throw new Error(
              `tiptap-editor config.theme.colors[${i}] must be a plain object`
            );
          }

          for (const key of Object.keys(entry)) {
            if (isReservedObjectKey(key)) {
              throw new Error(
                `tiptap-editor config.theme.colors[${i}] contains disallowed reserved key: "${key}"`
              );
            }
            if (key !== 'label' && key !== 'color') {
              throw new Error(
                `tiptap-editor config.theme.colors[${i}] has unknown key: "${key}". Allowed keys: label, color`
              );
            }
          }

          if (typeof entry.label !== 'string') {
            throw new Error(
              `tiptap-editor config.theme.colors[${i}].label must be a string`
            );
          }

          if (typeof entry.color !== 'string') {
            throw new Error(
              `tiptap-editor config.theme.colors[${i}].color must be a string`
            );
          }

          if (!isValidColorValue(entry.color)) {
            throw new Error(
              `tiptap-editor config.theme.colors[${i}] has invalid color value: "${entry.color}". ` +
                `Accepted formats: hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla(), var(--name)`
            );
          }
        }
      }
    }

    if (settings !== undefined) {
      if (!isPlainObject(settings)) {
        throw new Error('tiptap-editor config.settings must be a plain object');
      }
      assertNoReservedKeysDeep(settings, 'config.settings');
    }

    if (fieldBindings !== undefined) {
      if (!Array.isArray(fieldBindings)) {
        throw new Error('tiptap-editor config.fieldBindings must be an array');
      }

      for (let i = 0; i < fieldBindings.length; i++) {
        const binding = fieldBindings[i];
        if (!isPlainObject(binding)) {
          throw new Error(`tiptap-editor config.fieldBindings[${i}] must be a plain object`);
        }

        for (const key of Object.keys(binding)) {
          if (isReservedObjectKey(key) || !FIELD_BINDING_KEYS.has(key)) {
            throw new Error(
              `tiptap-editor config.fieldBindings[${i}] has unknown or reserved key: "${key}". Allowed keys: uid, field, preset`
            );
          }
        }

        if (
          typeof binding.uid !== 'string' ||
          !binding.uid.trim() ||
          isReservedObjectKey(binding.uid.trim())
        ) {
          throw new Error(
            `tiptap-editor config.fieldBindings[${i}].uid must be a non-empty non-reserved string`
          );
        }

        if (
          typeof binding.field !== 'string' ||
          !binding.field.trim() ||
          isReservedObjectKey(binding.field.trim())
        ) {
          throw new Error(
            `tiptap-editor config.fieldBindings[${i}].field must be a non-empty non-reserved string`
          );
        }

        if (
          binding.preset !== undefined &&
          (typeof binding.preset !== 'string' ||
            !binding.preset.trim() ||
            isReservedObjectKey(binding.preset.trim()))
        ) {
          throw new Error(
            `tiptap-editor config.fieldBindings[${i}].preset must be a non-empty non-reserved string`
          );
        }
      }
    }
  },
} satisfies { default: TiptapPluginConfig; validator: (config: unknown) => void };

export default config;
