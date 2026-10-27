import { useFetchClient } from '@strapi/strapi/admin';
import { useState, useEffect, useMemo } from 'react';
import {
  TiptapPresetConfig,
  MINIMAL_PRESET_CONFIG,
} from '../../../shared/types';

export type PresetConfigResult = {
  config: TiptapPresetConfig | null;
  isLoading: boolean;
};

/**
 * React hook that fetches the effective TipTap preset configuration from the backend,
 * falling back to `MINIMAL_PRESET_CONFIG` if no preset is specified or the request fails.
 */
export function usePresetConfig(presetName?: string): PresetConfigResult {
  const { get } = useFetchClient();
  const normalizedPresetName = useMemo(
    () => presetName?.trim() || undefined,
    [presetName]
  );

  const [config, setConfig] = useState<TiptapPresetConfig | null>(
    normalizedPresetName ? null : MINIMAL_PRESET_CONFIG
  );
  const [isLoading, setIsLoading] = useState(Boolean(normalizedPresetName));
  const [loadedName, setLoadedName] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    if (!normalizedPresetName) {
      setConfig(MINIMAL_PRESET_CONFIG);
      setLoadedName(undefined);
      setIsLoading(false);
      return;
    }

    const fetchPreset = async () => {
      setIsLoading(true);
      try {
        const response = await get(
          `/tiptap-editor/presets/${normalizedPresetName}`
        );
        if (!mounted) return;
        setConfig(response.data || MINIMAL_PRESET_CONFIG);
        setLoadedName(normalizedPresetName);
      } catch (error) {
        console.warn(
          '[TiptapEditor] Failed to fetch preset config:',
          error
        );
        if (!mounted) return;
        setConfig(MINIMAL_PRESET_CONFIG);
        setLoadedName(normalizedPresetName);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPreset();
    return () => {
      mounted = false;
    };
  }, [get, normalizedPresetName]);

  return {
    config,
    isLoading:
      isLoading ||
      (normalizedPresetName !== undefined && loadedName !== normalizedPresetName),
  };
}
