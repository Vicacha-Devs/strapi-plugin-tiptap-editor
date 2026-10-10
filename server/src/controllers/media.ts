import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { LinkPreviewMetadata, UploadedRemoteAsset } from '../services/media';

interface MediaService {
  isSsrfSafeUrl(url: string): boolean;
  getLinkPreview(url: string): Promise<LinkPreviewMetadata>;
  uploadByUrl(url: string, alt?: string): Promise<UploadedRemoteAsset>;
}

const createMediaController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async linkPreview(ctx: Context): Promise<void> {
    const queryObj = (ctx.query || {}) as Record<string, unknown>;
    const url = typeof queryObj.url === 'string' ? queryObj.url.trim() : '';

    if (!url) {
      ctx.throw(400, 'Query parameter "url" is required');
      return;
    }

    const mediaService = strapi.plugin('tiptap-editor').service('media') as MediaService;
    if (!mediaService.isSsrfSafeUrl(url)) {
      ctx.throw(400, 'Provided URL is not allowed');
      return;
    }

    try {
      ctx.body = await mediaService.getLinkPreview(url);
    } catch (error) {
      ctx.throw(400, error instanceof Error ? error.message : 'Failed to fetch link preview');
    }
  },

  async uploadByUrl(ctx: Context): Promise<void> {
    const body = ((ctx.request as { body?: Record<string, unknown> })?.body || {}) as Record<
      string,
      unknown
    >;
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const alt = typeof body.alt === 'string' ? body.alt.trim() : undefined;

    if (!url) {
      ctx.throw(400, 'Body parameter "url" is required');
      return;
    }

    const mediaService = strapi.plugin('tiptap-editor').service('media') as MediaService;
    if (!mediaService.isSsrfSafeUrl(url)) {
      ctx.throw(400, 'Provided URL is not allowed');
      return;
    }

    try {
      ctx.body = await mediaService.uploadByUrl(url, alt);
    } catch (error) {
      ctx.throw(400, error instanceof Error ? error.message : 'Failed to process remote media URL');
    }
  },
});

export default createMediaController;
