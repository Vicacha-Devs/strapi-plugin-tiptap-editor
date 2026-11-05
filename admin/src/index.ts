import { Node, Mark, Extension, mergeAttributes } from '@tiptap/core';
import type { StrapiApp } from '@strapi/strapi/admin';
import { PLUGIN_ID } from '../../shared/src/pluginId';
import { Initializer } from './components/Initializer';
import { PresetSelect } from './components/PresetSelect';
import { MediaLibraryWrapper, type StrapiFile } from './components/MediaLibraryWrapper';
import { ToolbarButton } from './components/ToolbarButton';
import { captureApp } from './utils/strapiApp';
import { buttonComponent } from './builtins/button';
import {
  defineRichTextComponent,
  listRichTextComponents,
  registerRichTextComponent,
} from './registry/richTextComponents';
import {
  registerTiptapExtension,
  unregisterTiptapExtension,
  getRegisteredTiptapExtensions,
  clearRegisteredTiptapExtensions,
  isCustomExtensionEnabledForPreset,
  type TiptapCustomExtensionRegistration,
  type CustomExtensionToolbarProps,
  type CustomExtensionDialogProps,
  type CustomSlashCommandItem,
  type CustomSlashCommandHelpers,
} from './utils/customExtensionRegistry';

import { richTextField } from './fields/richTextField';

export {
  Node,
  Mark,
  Extension,
  mergeAttributes,
  registerTiptapExtension,
  unregisterTiptapExtension,
  getRegisteredTiptapExtensions,
  clearRegisteredTiptapExtensions,
  isCustomExtensionEnabledForPreset,
  MediaLibraryWrapper,
  ToolbarButton,
  type StrapiFile,
  type TiptapCustomExtensionRegistration,
  type CustomExtensionToolbarProps,
  type CustomExtensionDialogProps,
  type CustomSlashCommandItem,
  type CustomSlashCommandHelpers,
};

export default {
  register(app: StrapiApp) {
    captureApp(app as never);
    registerRichTextComponent(buttonComponent);

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
      apis: {
        richTextComponents: {
          register: registerRichTextComponent,
          define: defineRichTextComponent,
          list: listRichTextComponents,
        },
        registerExtension: registerTiptapExtension,
        unregisterExtension: unregisterTiptapExtension,
        getRegisteredExtensions: getRegisteredTiptapExtensions,
        clearRegisteredExtensions: clearRegisteredTiptapExtensions,
      },
    });

    app.customFields.register(
      richTextField as unknown as Parameters<typeof app.customFields.register>[0]
    );

    if (typeof (app as Record<string, any>).addSettingsLink === 'function') {
      app.addSettingsLink('global', {
        intlLabel: {
          id: `${PLUGIN_ID}.settings.title`,
          defaultMessage: 'Tiptap Editor',
        },
        id: `${PLUGIN_ID}-settings`,
        to: PLUGIN_ID,
        Component: () => import('./pages/SettingsPage'),
        permissions: [
          {
            action: `plugin::${PLUGIN_ID}.settings.update`,
            subject: null,
          },
        ],
      });
    }
  },

  async bootstrap(app: StrapiApp) {
    const ctbPlugin = app.getPlugin('content-type-builder') as Record<string, any> | undefined;
    const components = ctbPlugin?.apis?.forms?.components;
    if (components && typeof components.add === 'function') {
      components.add({
        id: 'preset-select',
        component: PresetSelect,
      });
    }
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

export {
  clearRichTextComponents,
  defineRichTextComponent,
  getRichTextComponent,
  listRichTextComponents,
  registerRichTextComponent,
} from './registry/richTextComponents';
export type {
  AnyRichTextComponentDefinition,
  IntlLabel,
  RichTextComponentContext,
  RichTextComponentDefinition,
  RichTextComponentFormProps,
  RichTextComponentHelpers,
  RichTextComponentPreviewProps,
} from './registry/types';
export { buttonComponent, type ButtonAttrs } from './builtins/button';
export { ColorPickerPopover } from './components/ColorPickerPopover';
export type { ThemeColorEntry } from '../../shared/src/types';
