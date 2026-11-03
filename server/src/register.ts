import type { Core } from '@strapi/strapi';

import { richTextField } from './fields/richTextField';

export interface TiptapFieldBinding {
  uid: string;
  field: string;
  preset?: string;
}

interface TiptapPluginConfig {
  fieldBindings?: TiptapFieldBinding[];
}

const PLUGIN_ID = richTextField.plugin;

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

const hasOwn = (obj: unknown, key: string): boolean =>
  Boolean(obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key));

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register(richTextField);

  const pluginConfig = (strapi.config?.get?.(`plugin::${PLUGIN_ID}`) ??
    {}) as TiptapPluginConfig;

  if (Array.isArray(pluginConfig.fieldBindings)) {
    const contentTypes = (strapi.contentTypes ?? {}) as unknown as Record<
      string,
      {
        attributes?: Record<string, Record<string, unknown>>;
        __schema__?: { attributes?: Record<string, Record<string, unknown>> };
      }
    >;

    for (const binding of pluginConfig.fieldBindings) {
      if (
        !binding ||
        typeof binding.uid !== 'string' ||
        typeof binding.field !== 'string' ||
        !binding.uid ||
        !binding.field ||
        isReservedObjectKey(binding.uid) ||
        isReservedObjectKey(binding.field) ||
        (binding.preset !== undefined &&
          (typeof binding.preset !== 'string' || isReservedObjectKey(binding.preset)))
      ) {
        continue;
      }
      if (!hasOwn(contentTypes, binding.uid)) continue;
      const ct = contentTypes[binding.uid];
      if (!ct) continue;

      if (hasOwn(ct.attributes, binding.field) && ct.attributes?.[binding.field]) {
        ct.attributes[binding.field].customField = `plugin::${PLUGIN_ID}.RichText`;
        if (binding.preset) {
          ct.attributes[binding.field].options = {
            ...((ct.attributes[binding.field].options as Record<string, unknown>) ?? {}),
            preset: binding.preset,
          };
        }
      }

      if (
        hasOwn(ct.__schema__?.attributes, binding.field) &&
        ct.__schema__?.attributes?.[binding.field]
      ) {
        ct.__schema__.attributes[binding.field].customField = `plugin::${PLUGIN_ID}.RichText`;
        if (binding.preset) {
          ct.__schema__.attributes[binding.field].options = {
            ...((ct.__schema__.attributes[binding.field].options as Record<string, unknown>) ??
              {}),
            preset: binding.preset,
          };
        }
      }
    }
  }
};

export default register;
