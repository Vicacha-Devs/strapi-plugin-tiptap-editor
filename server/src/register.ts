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
      if (!binding?.uid || !binding?.field) continue;
      const ct = contentTypes[binding.uid];
      if (!ct) continue;

      if (ct.attributes?.[binding.field]) {
        ct.attributes[binding.field].customField = `plugin::${PLUGIN_ID}.RichText`;
        if (binding.preset) {
          ct.attributes[binding.field].options = {
            ...((ct.attributes[binding.field].options as Record<string, unknown>) ?? {}),
            preset: binding.preset,
          };
        }
      }

      if (ct.__schema__?.attributes?.[binding.field]) {
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
