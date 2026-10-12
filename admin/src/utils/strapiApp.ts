import type { ComponentType } from 'react';
import type { StrapiFile } from '../components/MediaLibraryWrapper';

export interface MediaLibraryDialogProps {
  onClose: () => void;
  onSelectAssets: (assets: StrapiFile[]) => void;
  allowedTypes?: Array<'files' | 'images' | 'videos' | 'audios'>;
  multiple?: boolean;
}

interface AppBridge {
  library: {
    components: {
      'media-library'?: ComponentType<MediaLibraryDialogProps>;
    };
  };
}

/**
 * Module-level reference to the StrapiApp instance, captured during register().
 * Used to access the component registry (e.g. media-library dialog) at render time
 * without relying on useStrapiApp — which fails due to use-context-selector
 * context isolation between the plugin bundle and the host app.
 */
let appRef: AppBridge | null = null;

export function captureApp(app: AppBridge) {
  appRef = app;
}

export function getMediaLibraryComponent(): ComponentType<MediaLibraryDialogProps> | null {
  return appRef?.library?.components?.['media-library'] ?? null;
}

export interface UploadedStrapiAsset {
  id?: number;
  documentId?: string;
  url?: string;
  name?: string;
  alternativeText?: string;
  caption?: string;
  mime?: string;
  width?: number;
  height?: number;
}

/**
 * Uploads a `FormData` payload to Strapi's `/upload` endpoint using `fetch`
 * and any active Strapi admin bearer token / session cookie, avoiding top-level
 * `@strapi/strapi/admin` imports inside extension modules.
 */
export async function uploadFileToStrapi(
  formData: FormData
): Promise<UploadedStrapiAsset | null> {
  if (typeof fetch !== 'function') return null;

  let rawToken: string | null = null;
  try {
    if (typeof window !== 'undefined') {
      rawToken =
        window.localStorage?.getItem('jwtToken') ??
        window.sessionStorage?.getItem('jwtToken') ??
        null;
      if (rawToken && rawToken.startsWith('"') && rawToken.endsWith('"')) {
        rawToken = JSON.parse(rawToken);
      }
    }
  } catch {
    rawToken = null;
  }

  const headers: Record<string, string> = {};
  if (rawToken) {
    headers.Authorization = `Bearer ${rawToken}`;
  }

  const response = await fetch('/upload', {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const uploaded = Array.isArray(payload)
    ? payload[0]
    : Array.isArray(payload?.data)
      ? payload.data[0]
      : payload?.data;

  return uploaded && typeof uploaded === 'object' ? (uploaded as UploadedStrapiAsset) : null;
}
