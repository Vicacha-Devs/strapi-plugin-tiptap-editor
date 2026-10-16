import type { Core } from '@strapi/strapi';
import { DEFAULT_RUNTIME_SETTINGS } from '../../shared/types';

export const LINKS_COMPONENT_UID = 'links.links';
export const SETTINGS_STORE_KEY = 'settings';
export const SETTINGS_UPDATE_PERMISSION = 'plugin::tiptap-editor.settings.update';
export const EXPLORER_READ_PERMISSION = 'plugin::tiptap-editor.explorer.read';

/**
 * Initializes plugin runtime settings in Strapi core-store and registers RBAC permissions.
 */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  try {
    // 1. Register admin RBAC permissions for settings & content linker search
    const actionProvider = (
      strapi as unknown as {
        admin?: {
          services?: {
            permission?: {
              actionProvider?: {
                registerMany?: (actions: Array<Record<string, unknown>>) => Promise<void> | void;
              };
            };
          };
        };
      }
    )?.admin?.services?.permission?.actionProvider;

    if (actionProvider && typeof actionProvider.registerMany === 'function') {
      await actionProvider.registerMany([
        {
          section: 'plugins',
          displayName: 'Update settings',
          uid: 'settings.update',
          pluginName: 'tiptap-editor',
        },
        {
          section: 'plugins',
          displayName: 'Search linkable content',
          uid: 'explorer.read',
          pluginName: 'tiptap-editor',
        },
      ]);
    }

    // 2. Ensure runtime settings exist in Strapi core-store
    if (typeof strapi?.store === 'function') {
      const pluginStore = strapi.store({
        type: 'plugin',
        name: 'tiptap-editor',
      });
      const existingSettings = await pluginStore.get({ key: SETTINGS_STORE_KEY });
      if (!existingSettings) {
        await pluginStore.set({
          key: SETTINGS_STORE_KEY,
          value: DEFAULT_RUNTIME_SETTINGS,
        });
      }
    }
  } catch (error) {
    strapi?.log?.warn?.(
      `[tiptap-editor] Bootstrap initialization warning: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export default bootstrap;
