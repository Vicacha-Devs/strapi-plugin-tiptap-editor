import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { TiptapRuntimeSettings } from '../../../shared/types';

interface SettingsService {
  getSettings(): Promise<Required<TiptapRuntimeSettings>>;
  updateSettings(input: unknown): Promise<Required<TiptapRuntimeSettings>>;
}

const createSettingsController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: Context): Promise<void> {
    const settingsService = strapi.plugin('tiptap-editor').service('settings') as SettingsService;
    ctx.body = await settingsService.getSettings();
  },

  async update(ctx: Context): Promise<void> {
    const settingsService = strapi.plugin('tiptap-editor').service('settings') as SettingsService;
    const body = (ctx.request as { body?: unknown })?.body;
    try {
      ctx.body = await settingsService.updateSettings(body);
    } catch (error) {
      ctx.throw(400, error instanceof Error ? error.message : 'Invalid settings payload');
    }
  },
});

export default createSettingsController;
