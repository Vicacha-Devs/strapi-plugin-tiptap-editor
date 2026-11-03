import { describe, it, expect } from 'vitest';
import {
  parseStrapiLinkUri,
  formatStrapiLinkUri,
  extractRelationsFromJSON,
} from '../../shared/src/relations';
import allFeaturesPayload from '../../fixtures/all-features-payload.json';

describe('shared/relations', () => {
  describe('parseStrapiLinkUri & formatStrapiLinkUri', () => {
    it('formats and parses valid strapi:// URIs', () => {
      const uri = formatStrapiLinkUri('api::article.article', 'doc-123');
      expect(uri).toBe('strapi://api::article.article/doc-123');
      expect(parseStrapiLinkUri(uri)).toEqual({
        collectionName: 'api::article.article',
        documentId: 'doc-123',
      });
    });

    it('returns null for external or invalid URIs', () => {
      expect(parseStrapiLinkUri('https://example.com/page')).toBeNull();
      expect(parseStrapiLinkUri('strapi://missing-slash')).toBeNull();
      expect(parseStrapiLinkUri('')).toBeNull();
      expect(parseStrapiLinkUri(null)).toBeNull();
    });
  });

  describe('extractRelationsFromJSON', () => {
    it('extracts image, video, audio, attachment, linker, and strapi:// link marks', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: '/uploads/photo.jpg',
              'data-asset-id': 10,
              'data-document-id': 'doc-img-10',
            },
          },
          {
            type: 'video',
            attrs: {
              src: '/uploads/clip.mp4',
              'data-asset-id': '20',
              'data-document-id': 'doc-vid-20',
            },
          },
          {
            type: 'audio',
            attrs: {
              src: '/uploads/voice.webm',
              'data-asset-id': 30,
              'data-document-id': 'doc-aud-30',
            },
          },
          {
            type: 'attachment',
            attrs: {
              href: '/uploads/report.pdf',
              'data-asset-id': 40,
              'data-document-id': 'doc-att-40',
            },
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'linker',
                attrs: {
                  collectionName: 'api::article.article',
                  documentId: 'art-1',
                  label: 'Article 1',
                },
              },
              {
                type: 'text',
                text: 'Inline internal link',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: 'strapi://api::page.page/page-99',
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      const res = extractRelationsFromJSON(doc);
      expect(res.mediaIds).toEqual([10, 20, 30, 40]);
      expect(res.mediaDocumentIds).toEqual([
        'doc-img-10',
        'doc-vid-20',
        'doc-aud-30',
        'doc-att-40',
      ]);
      expect(res.mediaAssets).toHaveLength(4);
      expect(res.internalLinks).toHaveLength(2);
      expect(res.linksByCollection['api::article.article']).toHaveLength(1);
      expect(res.linksByCollection['api::page.page']).toHaveLength(1);
    });

    it('extracts relations from fixtures/all-features-payload.json without duplicates', () => {
      const res = extractRelationsFromJSON(allFeaturesPayload);
      expect(new Set(res.mediaIds).size).toBe(res.mediaIds.length);
      expect(new Set(res.mediaDocumentIds).size).toBe(res.mediaDocumentIds.length);
      expect(res.mediaIds).toContain(42);
      expect(res.mediaIds).toContain(201);
      expect(res.mediaIds).toContain(202);
      expect(res.mediaIds).toContain(203);
      expect(res.mediaDocumentIds).toContain('doc-video-201');
      expect(res.mediaDocumentIds).toContain('doc-audio-202');
      expect(res.mediaDocumentIds).toContain('doc-file-203');
      expect(res.linksByCollection['api::article.article']?.[0]?.documentId).toBe(
        'doc-article-99'
      );
    });

    it('handles null or primitive inputs safely', () => {
      expect(extractRelationsFromJSON(null)).toEqual({
        mediaAssets: [],
        mediaIds: [],
        mediaDocumentIds: [],
        internalLinks: [],
        linksByCollection: {},
      });
    });

    it('rejects prototype pollution keys in parseStrapiLinkUri and extractRelationsFromJSON', () => {
      const protoKeys = [
        '__proto__',
        'constructor',
        'prototype',
        'toString',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
      ];

      for (const badKey of protoKeys) {
        expect(parseStrapiLinkUri(`strapi://${badKey}/doc-1`)).toBeNull();
        expect(parseStrapiLinkUri(`strapi://api::article.article/${badKey}`)).toBeNull();
      }

      const maliciousDoc = {
        type: 'doc',
        content: [
          {
            type: 'linker',
            attrs: { collectionName: '__proto__', documentId: 'polluted', label: 'Bad' },
          },
          {
            type: 'linker',
            attrs: { collectionName: 'constructor', documentId: 'doc-1', label: 'Bad2' },
          },
          {
            type: 'linker',
            attrs: { collectionName: 'toString', documentId: 'doc-2', label: 'Bad3' },
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click',
                marks: [{ type: 'link', attrs: { href: 'strapi://hasOwnProperty/doc-3' } }],
              },
            ],
          },
        ],
      };

      const res = extractRelationsFromJSON(maliciousDoc);
      expect(res.internalLinks).toEqual([]);
      expect(Object.keys(res.linksByCollection)).toEqual([]);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('extracts strapi:// internal links from button and custom component attributes recursively', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'button',
            attrs: {
              label: 'Read Article',
              href: 'strapi://api::article.article/art-42',
              variant: 'primary',
              openInNewTab: false,
            },
          },
          {
            type: 'pricingTable',
            attrs: {
              label: 'Pricing CTA',
              primaryUrl: 'strapi://api::page.page/pricing-page',
              tiers: [
                {
                  label: 'Enterprise Plan',
                  ctaHref: 'strapi://api::plan.plan/ent-1',
                },
              ],
            },
          },
        ],
      };

      const res = extractRelationsFromJSON(doc);
      expect(res.internalLinks).toEqual([
        {
          collectionName: 'api::article.article',
          documentId: 'art-42',
          href: 'strapi://api::article.article/art-42',
          label: 'Read Article',
        },
        {
          collectionName: 'api::page.page',
          documentId: 'pricing-page',
          href: 'strapi://api::page.page/pricing-page',
          label: 'Pricing CTA',
        },
        {
          collectionName: 'api::plan.plan',
          documentId: 'ent-1',
          href: 'strapi://api::plan.plan/ent-1',
          label: 'Enterprise Plan',
        },
      ]);
      expect(res.linksByCollection).toEqual({
        'api::article.article': [{ documentId: 'art-42' }],
        'api::page.page': [{ documentId: 'pricing-page' }],
        'api::plan.plan': [{ documentId: 'ent-1' }],
      });
    });
  });
});
