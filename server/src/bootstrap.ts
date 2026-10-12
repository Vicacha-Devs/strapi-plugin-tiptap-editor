import type { Core } from '@strapi/strapi';
import { DEFAULT_RUNTIME_SETTINGS } from '../../shared/types';

export const LINKS_COMPONENT_UID = 'links.links';
export const SETTINGS_STORE_KEY = 'settings';
export const SETTINGS_UPDATE_PERMISSION = 'plugin::tiptap-editor.settings.update';
export const EXPLORER_READ_PERMISSION = 'plugin::tiptap-editor.explorer.read';

/**
 * Initializes plugin runtime settings in Strapi core-store, registers RBAC permissions,
 * and ensures the `links.links` component exists for relational internal link tracking.
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

    // 3. Ensure 'links.links' component exists for Relational Internal Links Sync
    const components = (strapi as unknown as { components?: Record<string, unknown> })?.components;
    if (components && !components[LINKS_COMPONENT_UID]) {
      const ctbPlugin = strapi.plugin?.('content-type-builder');
      const componentService = ctbPlugin?.service?.('components') as
        | {
            createComponent?: (payload: {
              component: {
                category: string;
                displayName: string;
                icon: string;
                attributes: Record<string, unknown>;
              };
            }) => Promise<unknown>;
          }
        | undefined;

      if (componentService && typeof componentService.createComponent === 'function') {
        await componentService.createComponent({
          component: {
            category: 'links',
            displayName: 'Links',
            icon: 'link',
            attributes: {},
          },
        });
        strapi.log?.info?.(
          '[tiptap-editor] Created "links.links" component for relational internal link tracking.'
        );
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
