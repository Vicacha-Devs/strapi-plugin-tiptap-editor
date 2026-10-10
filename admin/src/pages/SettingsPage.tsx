import { useState, useEffect } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  Box,
  Flex,
  Typography,
  Button,
  SingleSelect,
  SingleSelectOption,
  Checkbox,
  TextInput,
} from '@strapi/design-system';
import {
  PRESET_FEATURE_KEYS,
  DEFAULT_RUNTIME_SETTINGS,
  BUILT_IN_PRESETS,
  type TiptapRuntimeSettings,
  type TiptapOutputFormat,
} from '../../../shared/types';

export function SettingsPage() {
  const { get, put } = useFetchClient();
  const [settings, setSettings] = useState<TiptapRuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);
  const [selectedPreset, setSelectedPreset] = useState<string>('default');
  const [iframeDomainsInput, setIframeDomainsInput] = useState<string>(
    DEFAULT_RUNTIME_SETTINGS.allowedIframeDomains.join(', ')
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    get('/tiptap-editor/settings')
      .then((res: { data?: TiptapRuntimeSettings }) => {
        if (!mounted || !res?.data) return;
        const loaded = {
          ...DEFAULT_RUNTIME_SETTINGS,
          ...res.data,
          presetOverrides: {
            ...BUILT_IN_PRESETS,
            ...(res.data.presetOverrides || {}),
          },
        };
        setSettings(loaded);
        setIframeDomainsInput((loaded.allowedIframeDomains || []).join(', '));
      })
      .catch(() => {
        // Keep defaults on error
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [get]);

  const currentPresetConfig =
    settings.presetOverrides?.[selectedPreset] ?? BUILT_IN_PRESETS[selectedPreset] ?? {};

  const handleToggleFeature = (featureKey: keyof typeof currentPresetConfig, enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      presetOverrides: {
        ...prev.presetOverrides,
        [selectedPreset]: {
          ...(prev.presetOverrides?.[selectedPreset] ?? BUILT_IN_PRESETS[selectedPreset] ?? {}),
          [featureKey]: enabled,
        },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const domains = iframeDomainsInput
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      const payload: TiptapRuntimeSettings = {
        ...settings,
        allowedIframeDomains: domains,
      };
      const res = await put('/tiptap-editor/settings', payload);
      if (res?.data) {
        setSettings(res.data);
      }
      setSaveMessage('Settings saved successfully.');
    } catch {
      setSaveMessage('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box padding={8}>
        <Typography>Loading Tiptap Editor settings...</Typography>
      </Box>
    );
  }

  const presetNames = Array.from(
    new Set([...Object.keys(BUILT_IN_PRESETS), ...Object.keys(settings.presetOverrides || {})])
  );

  return (
    <Box padding={8} background="neutral100">
      <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Box>
          <Typography variant="alpha" tag="h1">
            Tiptap Editor Settings
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            Configure global defaults, relational sync, iframe security, and toolbar presets.
          </Typography>
        </Box>
        <Button onClick={handleSave} loading={isSaving}>
          Save Settings
        </Button>
      </Flex>

      {saveMessage && (
        <Box
          padding={3}
          marginBottom={4}
          background="primary100"
          borderColor="primary200"
          hasRadius
        >
          <Typography textColor="primary700">{saveMessage}</Typography>
        </Box>
      )}

      <Box
        padding={6}
        marginBottom={6}
        background="neutral0"
        shadow="filterShadow"
        hasRadius
      >
        <Typography variant="delta" tag="h2">
          Global Configuration
        </Typography>

        <Flex gap={6} wrap="wrap" marginTop={4}>
          <Box style={{ minWidth: '220px' }}>
            <Typography variant="pi" fontWeight="bold">
              Default Preset
            </Typography>
            <Box marginTop={1}>
              <SingleSelect
                value={settings.defaultPreset}
                onChange={(val: string | number) =>
                  setSettings((prev) => ({ ...prev, defaultPreset: String(val) }))
                }
              >
                {presetNames.map((name) => (
                  <SingleSelectOption key={name} value={name}>
                    {name}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
            </Box>
          </Box>

          <Box style={{ minWidth: '220px' }}>
            <Typography variant="pi" fontWeight="bold">
              Default Output Format
            </Typography>
            <Box marginTop={1}>
              <SingleSelect
                value={settings.defaultOutputFormat}
                onChange={(val: string | number) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultOutputFormat: String(val) as TiptapOutputFormat,
                  }))
                }
              >
                <SingleSelectOption value="json">JSON (ProseMirror Document)</SingleSelectOption>
                <SingleSelectOption value="html">HTML String</SingleSelectOption>
                <SingleSelectOption value="markdown">Markdown String</SingleSelectOption>
              </SingleSelect>
            </Box>
          </Box>

          <Box style={{ minWidth: '320px', flex: 1 }}>
            <Typography variant="pi" fontWeight="bold">
              Allowed Iframe Domains (comma-separated)
            </Typography>
            <Box marginTop={1}>
              <TextInput
                name="allowedIframeDomains"
                value={iframeDomainsInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setIframeDomainsInput(e.target.value)
                }
              />
            </Box>
          </Box>
        </Flex>

        <Box marginTop={4}>
          <Checkbox
            checked={settings.enableRelationalSync}
            onCheckedChange={(checked: boolean) =>
              setSettings((prev) => ({ ...prev, enableRelationalSync: Boolean(checked) }))
            }
          >
            Automatically sync embedded Media (&lt;FieldName&gt;Media) and Internal Links (&lt;FieldName&gt;Links)
          </Checkbox>
        </Box>
      </Box>

      <Box padding={6} background="neutral0" shadow="filterShadow" hasRadius>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Typography variant="delta" tag="h2">
            Preset Feature Matrix
          </Typography>
          <Box style={{ minWidth: '220px' }}>
            <SingleSelect
              value={selectedPreset}
              onChange={(val: string | number) => setSelectedPreset(String(val))}
            >
              {presetNames.map((name) => (
                <SingleSelectOption key={name} value={name}>
                  {name}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
        </Flex>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '12px',
          }}
        >
          {PRESET_FEATURE_KEYS.map((featureKey) => {
            const isChecked = Boolean(currentPresetConfig[featureKey]);
            return (
              <Box
                key={featureKey}
                padding={2}
                background="neutral100"
                hasRadius
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked: boolean) =>
                    handleToggleFeature(featureKey, Boolean(checked))
                  }
                >
                  {featureKey}
                </Checkbox>
              </Box>
            );
          })}
        </div>
      </Box>
    </Box>
  );
}

export default SettingsPage;
