const SAFE_URL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:', 'strapi:']);

/**
 * Decodes HTML character references (named & numeric decimal/hex) and strips control characters
 * so obfuscated schemes like `java&#x09;script:` or `&#106;avascript:` are caught.
 */
const safeFromCodePoint = (code: number): string =>
  Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';

function decodeHtmlEntitiesForUrlCheck(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Validates that a URL uses a safe protocol or is a relative/anchor link.
 * Blocks `javascript:`, `vbscript:`, `data:text/html`, and protocol-relative `//` or `/\` URLs.
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const decoded = decodeHtmlEntitiesForUrlCheck(url);
  const trimmed = decoded.trim();
  if (!trimmed) return false;

  const normalized = trimmed.replace(/[\u0000-\u001F\s]/g, '');
  if (!normalized) return false;

  // Relative paths and anchor links (disallow protocol-relative // or /\)
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return !/^[\/\\]{2}/.test(normalized);
  }

  // Internal Strapi link protocol
  if (normalized.toLowerCase().startsWith('strapi://')) {
    return true;
  }

  const lower = normalized.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return false;
  }

  // Allow safe data:image/* (except svg+xml which can embed scripts) and data:audio/*
  if (lower.startsWith('data:image/')) {
    return !lower.startsWith('data:image/svg');
  }
  if (lower.startsWith('data:audio/')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Validates an iframe embed URL against HTTPS requirement and optional domain allowlist.
 */
export function isSafeIframeUrl(url: string, allowedDomains?: string[]): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;

    if (Array.isArray(allowedDomains) && allowedDomains.length > 0) {
      const host = parsed.hostname.toLowerCase();
      return allowedDomains.some((domain) => {
        const cleanDomain = domain.trim().toLowerCase();
        return cleanDomain.length > 0 && (host === cleanDomain || host.endsWith(`.${cleanDomain}`));
      });
    }
    return true;
  } catch {
    return false;
  }
}
