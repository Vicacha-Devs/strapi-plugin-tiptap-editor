import type { Core } from '@strapi/strapi';

export interface LinkPreviewMetadata {
  url: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string | null;
}

export interface UploadedRemoteAsset {
  id: number | null;
  documentId: string | null;
  name: string;
  url: string;
  mime: string;
  size?: number;
  alternativeText?: string;
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|\[::1\]|\[fc[0-9a-f]{2}:.*\]|\[fd[0-9a-f]{2}:.*\]|\[fe80:.*\]|.*\.local|.*\.internal)$/i;

/**
 * Validates that a remote URL is safe against SSRF (blocks loopback, private subnets,
 * cloud metadata endpoints, and non-HTTP(S) schemes).
 */
export function isSsrfSafeUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || PRIVATE_HOST_RE.test(hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractMetaTag(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'i'
    ),
  ];
  for (const regex of patterns) {
    const match = regex.exec(html);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1] ? match[1].trim() : null;
}

const createMediaService = ({ strapi }: { strapi: Core.Strapi }) => ({
  isSsrfSafeUrl,

  async getLinkPreview(rawUrl: string): Promise<LinkPreviewMetadata> {
    if (!isSsrfSafeUrl(rawUrl)) {
      throw new Error('URL is not allowed or failed SSRF safety validation');
    }

    const cleanUrl = rawUrl.trim();
    const parsedUrl = new URL(cleanUrl);

    if (typeof globalThis.fetch !== 'function') {
      return {
        url: cleanUrl,
        title: parsedUrl.hostname,
        description: '',
        image: null,
        siteName: parsedUrl.hostname,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await globalThis.fetch(cleanUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'StrapiTiptapLinkPreview/1.0',
        },
      });

      if (!response.ok) {
        return {
          url: cleanUrl,
          title: parsedUrl.hostname,
          description: '',
          image: null,
          siteName: parsedUrl.hostname,
        };
      }

      const html = (await response.text()).slice(0, 150_000);
      const title =
        extractMetaTag(html, 'og:title') ||
        extractMetaTag(html, 'twitter:title') ||
        extractHtmlTitle(html) ||
        parsedUrl.hostname;
      const description =
        extractMetaTag(html, 'og:description') ||
        extractMetaTag(html, 'twitter:description') ||
        extractMetaTag(html, 'description') ||
        '';
      const rawImage =
        extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image') || null;
      const safeImage = rawImage && isSsrfSafeUrl(rawImage) ? rawImage : null;
      const siteName = extractMetaTag(html, 'og:site_name') || parsedUrl.hostname;

      return {
        url: cleanUrl,
        title: title.slice(0, 300),
        description: description.slice(0, 600),
        image: safeImage,
        siteName: siteName.slice(0, 120),
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  async uploadByUrl(rawUrl: string, customAlt?: string): Promise<UploadedRemoteAsset> {
    if (!isSsrfSafeUrl(rawUrl)) {
      throw new Error('URL is not allowed or failed SSRF safety validation');
    }

    const cleanUrl = rawUrl.trim();
    const parsedUrl = new URL(cleanUrl);
    const pathnameParts = parsedUrl.pathname.split('/').filter(Boolean);
    const rawFilename = pathnameParts[pathnameParts.length - 1] || 'remote-media';
    const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

    return {
      id: null,
      documentId: null,
      name: safeFilename,
      url: cleanUrl,
      mime: 'image/jpeg',
      alternativeText: customAlt || safeFilename,
    };
  },
});

export default createMediaService;
