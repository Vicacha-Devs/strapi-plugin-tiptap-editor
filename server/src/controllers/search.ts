import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
import type { SearchDocumentHit } from '../services/search';

interface SearchService {
  identifyCollectionTitleField(collectionName: string): string;
  getLinkableCollections(): Array<{ attributeName: string; targetUid: string }>;
  search(query: string, locale?: string): Promise<Record<string, SearchDocumentHit[]>>;
  getDocument(
    collectionName: string,
    documentId: string,
    locale?: string
  ): Promise<SearchDocumentHit | null>;
}

const createSearchController = ({ strapi }: { strapi: Core.Strapi }) => ({
  async search(ctx: Context): Promise<void> {
    const queryObj = (ctx.query || {}) as Record<string, unknown>;
    const q = typeof queryObj.q === 'string' ? queryObj.q.trim() : '';
    const locale = typeof queryObj.locale === 'string' ? queryObj.locale.trim() : undefined;

    if (!q) {
      ctx.body = { results: {}, collections: [] };
      return;
    }

    const searchService = strapi.plugin('tiptap-editor').service('search') as SearchService;
    const results = await searchService.search(q, locale);
    const collections = searchService.getLinkableCollections();
    ctx.body = { results, collections };
  },

  async getDocument(ctx: Context): Promise<void> {
    const collectionName = ctx.params?.collectionName;
    const documentId = ctx.params?.documentId;
    const queryObj = (ctx.query || {}) as Record<string, unknown>;
    const locale = typeof queryObj.locale === 'string' ? queryObj.locale.trim() : undefined;

    if (typeof collectionName !== 'string' || typeof documentId !== 'string') {
      ctx.throw(400, 'collectionName and documentId are required');
      return;
    }

    const searchService = strapi.plugin('tiptap-editor').service('search') as SearchService;
    try {
      const doc = await searchService.getDocument(collectionName, documentId, locale);
      if (!doc) {
        ctx.throw(404, 'Document not found');
        return;
      }
      ctx.body = doc;
    } catch (error) {
      if ((error as { status?: number })?.status === 404) {
        throw error;
      }
      ctx.throw(400, error instanceof Error ? error.message : 'Invalid document lookup parameters');
    }
  },

  async identify(ctx: Context): Promise<void> {
    const collectionName = ctx.params?.collectionName;
    if (typeof collectionName !== 'string') {
      ctx.throw(400, 'collectionName is required');
      return;
    }

    const searchService = strapi.plugin('tiptap-editor').service('search') as SearchService;
    try {
      const titleField = searchService.identifyCollectionTitleField(collectionName);
      ctx.body = { collectionName, titleField };
    } catch (error) {
      ctx.throw(400, error instanceof Error ? error.message : 'Invalid collectionName');
    }
  },
});

export default createSearchController;
