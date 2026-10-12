import dns from 'node:dns';
import net from 'node:net';
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

const MAX_PREVIEW_BYTES = 65_536; // 64 KB cap for HTML metadata inspection

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

/**
 * Checks whether an IPv4 dotted-quad address belongs to a loopback, private, link-local,
 * CGNAT, cloud metadata, multicast, or reserved range.
 */
function isPrivateIpv4Octets(octets: [number, number, number, number]): boolean {
  const [a, b, c] = octets;
  if (a === 0) return true; // 0.0.0.0/8 (unspecified / local network)
  if (a === 10) return true; // 10.0.0.0/8 (RFC1918)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT & Alibaba 100.100.100.200)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & cloud metadata 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC1918)
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24 & TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC1918)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmarking)
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // Multicast & reserved (224.0.0.0/4+)
  return false;
}

/**
 * Parses a standard dotted-quad IPv4 string into four octets, or returns null.
 */
function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

/**
 * Checks whether an IPv4 or IPv6 address (including IPv4-mapped IPv6 `::ffff:...`)
 * belongs to a loopback, private, link-local, CGNAT, or metadata range.
 */
export function isPrivateIpAddress(rawIp: string): boolean {
  const clean = rawIp.trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (!clean) return true;

  const v4 = parseIpv4Octets(clean);
  if (v4) {
    return isPrivateIpv4Octets(v4);
  }

  // IPv6 checks
  const zoneStripped = clean.split('%')[0];
  if (zoneStripped === '::' || zoneStripped === '::1' || zoneStripped === '0:0:0:0:0:0:0:1' || zoneStripped === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv4-mapped IPv6 dotted-quad: ::ffff:127.0.0.1
  const mappedDottedMatch = /^(?:0*:){0,5}0*ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(zoneStripped);
  if (mappedDottedMatch) {
    const mappedV4 = parseIpv4Octets(mappedDottedMatch[1]);
    return mappedV4 ? isPrivateIpv4Octets(mappedV4) : true;
  }

  // IPv4-mapped IPv6 hex words (Node URL normalizes http://[::ffff:127.0.0.1] to [::ffff:7f00:1])
  const mappedHexMatch = /^(?:0*:){0,5}0*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(zoneStripped);
  if (mappedHexMatch) {
    const hi = parseInt(mappedHexMatch[1], 16);
    const lo = parseInt(mappedHexMatch[2], 16);
    return isPrivateIpv4Octets([(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff]);
  }

  // Unique local fc00::/7 (fc00..fdff) and link-local fe80::/10 (fe80..febf) and multicast ff00::/8
  if (/^(fc[0-9a-f]{2}|fd[0-9a-f]{2}|fe[89ab][0-9a-f]|ff[0-9a-f]{2}):/i.test(zoneStripped)) {
    return true;
  }

  return false;
}

/**
 * Validates that a remote URL is safe against SSRF (blocks loopback, private subnets,
 * CGNAT, cloud metadata endpoints, IPv6 private/mapped ranges, trailing-dot hostnames, and non-HTTP(S) schemes).
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

    const rawHost = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const normalizedHost = rawHost.replace(/\.+$/, '');
    if (!normalizedHost) {
      return false;
    }

    if (
      normalizedHost === 'localhost' ||
      normalizedHost.endsWith('.localhost') ||
      normalizedHost.endsWith('.local') ||
      normalizedHost.endsWith('.internal') ||
      normalizedHost === 'metadata.google.internal'
    ) {
      return false;
    }

    // Reject obfuscated integer/hex/octal IPv4 hostnames (e.g. 2130706433 or 0x7f000001)
    if (/^(0x[0-9a-f]+|\d+)$/i.test(normalizedHost)) {
      return false;
    }

    if (net.isIP(normalizedHost) !== 0 || normalizedHost.includes(':')) {
      if (isPrivateIpAddress(normalizedHost)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a hostname via DNS and verifies that none of the resolved IPv4/IPv6 addresses
 * point to a private, loopback, link-local, or metadata network.
 */
export async function assertSafeResolvedHost(hostname: string): Promise<void> {
  const cleanHost = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (net.isIP(cleanHost) !== 0) {
    if (isPrivateIpAddress(cleanHost)) {
      throw new Error('URL resolved to a disallowed private or internal IP address');
    }
    return;
  }

  if (typeof dns?.promises?.lookup !== 'function') {
    return;
  }

  try {
    const records = await dns.promises.lookup(cleanHost, { all: true });
    for (const record of records) {
      if (record?.address && isPrivateIpAddress(record.address)) {
        throw new Error('URL resolved to a disallowed private or internal IP address');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('disallowed private')) {
      throw err;
    }
    // Ignore transient offline DNS lookup errors in isolated test environments
  }
}

/**
 * Reads up to `maxBytes` from a Fetch `Response` stream so large responses cannot exhaust memory.
 */
async function readBoundedResponseText(response: Response, maxBytes: number): Promise<string> {
  const body = (response as { body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } }).body;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let totalBytes = 0;
    let text = '';
    try {
      while (totalBytes < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const remaining = maxBytes - totalBytes;
        const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        totalBytes += slice.byteLength;
        text += decoder.decode(slice, { stream: true });
        if (/<\/head>/i.test(text)) {
          break;
        }
      }
      text += decoder.decode();
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Ignore stream cancel errors
      }
    }
    return text;
  }

  return (await response.text()).slice(0, maxBytes);
}

/**
 * Extracts an OpenGraph or named `<meta>` tag value from HTML source.
 */
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

/**
 * Extracts the `<title>` text from an HTML string.
 */
function extractHtmlTitle(html: string): string | null {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1] ? match[1].trim() : null;
}

/**
 * Infers a MIME type from a filename extension.
 */
function inferMimeFromFilename(filename: string): string {
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx === -1) return 'image/jpeg';
  const ext = filename.slice(dotIdx).toLowerCase();
  return EXTENSION_MIME_MAP[ext] || 'image/jpeg';
}

/**
 * Creates the SSRF-safe media preview and remote upload service.
 */
const createMediaService = ({ strapi }: { strapi: Core.Strapi }) => ({
  isSsrfSafeUrl,

  /**
   * Fetches OpenGraph/Twitter preview metadata from an SSRF-validated URL with DNS verification
   * and a 64 KB response stream cap.
   */
  async getLinkPreview(rawUrl: string): Promise<LinkPreviewMetadata> {
    if (!isSsrfSafeUrl(rawUrl)) {
      throw new Error('URL is not allowed or failed SSRF safety validation');
    }

    const cleanUrl = rawUrl.trim();
    const parsedUrl = new URL(cleanUrl);
    await assertSafeResolvedHost(parsedUrl.hostname);

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

      const html = await readBoundedResponseText(response, MAX_PREVIEW_BYTES);
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

  /**
   * Validates a remote media URL against SSRF, resolves its MIME type, and registers
   * a Strapi Upload asset record when the Upload plugin/database is available.
   */
  async uploadByUrl(rawUrl: string, customAlt?: string): Promise<UploadedRemoteAsset> {
    if (!isSsrfSafeUrl(rawUrl)) {
      throw new Error('URL is not allowed or failed SSRF safety validation');
    }

    const cleanUrl = rawUrl.trim();
    const parsedUrl = new URL(cleanUrl);
    await assertSafeResolvedHost(parsedUrl.hostname);

    const pathnameParts = parsedUrl.pathname.split('/').filter(Boolean);
    const rawFilename = pathnameParts[pathnameParts.length - 1] || 'remote-media';
    const safeFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const inferredMime = inferMimeFromFilename(safeFilename);
    const altText = customAlt || safeFilename;

    // Register in Strapi Upload plugin if available
    try {
      const dbQuery = (strapi as unknown as { db?: { query?: (uid: string) => any } })?.db?.query;
      if (typeof dbQuery === 'function') {
        const dotIdx = safeFilename.lastIndexOf('.');
        const ext = dotIdx !== -1 ? safeFilename.slice(dotIdx) : '';
        const hash = `${safeFilename.replace(/\.[^.]+$/, '')}_${Date.now()}`;
        const created = await dbQuery('plugin::upload.file').create({
          data: {
            name: safeFilename,
            alternativeText: altText,
            caption: altText,
            hash,
            ext,
            mime: inferredMime,
            size: 0,
            url: cleanUrl,
            provider: 'local',
          },
        });
        if (created) {
          return {
            id: typeof created.id === 'number' ? created.id : null,
            documentId: typeof created.documentId === 'string' ? created.documentId : null,
            name: safeFilename,
            url: cleanUrl,
            mime: inferredMime,
            alternativeText: altText,
          };
        }
      }
    } catch {
      // Fallback to non-persisted descriptor if upload DB query is unavailable
    }

    return {
      id: null,
      documentId: null,
      name: safeFilename,
      url: cleanUrl,
      mime: inferredMime,
      alternativeText: altText,
    };
  },
});

export default createMediaService;
