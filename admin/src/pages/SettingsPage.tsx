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
import { useIntl } from 'react-intl';
import {
  PRESET_FEATURE_KEYS,
  DEFAULT_RUNTIME_SETTINGS,
  BUILT_IN_PRESETS,
  type TiptapRuntimeSettings,
  type TiptapOutputFormat,
} from '../../../shared/types';

/**
 * Global Administration Settings page for the Tiptap Editor plugin.
 * Allows authorized administrators to configure default preset, output format,
 * allowed iframe domains, relational sync, and per-preset feature overrides.
 */
export function SettingsPage() {
  const { formatMessage } = useIntl();
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
        const loaded: TiptapRuntimeSettings = {
          ...DEFAULT_RUNTIME_SETTINGS,
          ...res.data,
          presetOverrides: res.data.presetOverrides || {},
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

  const currentPresetConfig = {
    ...(BUILT_IN_PRESETS[selectedPreset] ?? {}),
    ...(settings.presetOverrides?.[selectedPreset] ?? {}),
  };

  const handleToggleFeature = (featureKey: keyof typeof currentPresetConfig, enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      presetOverrides: {
        ...prev.presetOverrides,
        [selectedPreset]: {
          ...(prev.presetOverrides?.[selectedPreset] ?? {}),
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
        setSettings({
          ...DEFAULT_RUNTIME_SETTINGS,
          ...res.data,
          presetOverrides: res.data.presetOverrides || {},
        });
      }
      setSaveMessage(
        formatMessage({
          id: 'tiptap-editor.settings.saveSuccess',
          defaultMessage: 'Settings saved successfully.',
        })
      );
    } catch {
      setSaveMessage(
        formatMessage({
          id: 'tiptap-editor.settings.saveError',
          defaultMessage: 'Failed to save settings.',
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box padding={8}>
        <Typography>
          {formatMessage({
            id: 'tiptap-editor.settings.loading',
            defaultMessage: 'Loading Tiptap Editor settings...',
          })}
        </Typography>
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
            {formatMessage({
              id: 'tiptap-editor.settings.pageTitle',
              defaultMessage: 'Tiptap Editor Settings',
            })}
          </Typography>
          <Typography variant="epsilon" textColor="neutral600">
            {formatMessage({
              id: 'tiptap-editor.settings.pageDescription',
              defaultMessage:
                'Configure global defaults, relational sync, iframe security, and toolbar presets.',
            })}
          </Typography>
        </Box>
        <Button onClick={handleSave} loading={isSaving}>
          {formatMessage({
            id: 'tiptap-editor.settings.saveButton',
            defaultMessage: 'Save Settings',
          })}
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
          {formatMessage({
            id: 'tiptap-editor.settings.globalSectionTitle',
            defaultMessage: 'Global Configuration',
          })}
        </Typography>

        <Flex gap={6} wrap="wrap" marginTop={4}>
          <Box style={{ minWidth: '220px' }}>
            <Typography variant="pi" fontWeight="bold">
              {formatMessage({
                id: 'tiptap-editor.settings.defaultPresetLabel',
                defaultMessage: 'Default Preset',
              })}
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
              {formatMessage({
                id: 'tiptap-editor.settings.defaultOutputFormatLabel',
                defaultMessage: 'Default Output Format',
              })}
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
                <SingleSelectOption value="json">
                  {formatMessage({
                    id: 'tiptap-editor.settings.outputFormatJson',
                    defaultMessage: 'JSON (ProseMirror Document)',
                  })}
                </SingleSelectOption>
                <SingleSelectOption value="html">
                  {formatMessage({
                    id: 'tiptap-editor.settings.outputFormatHtml',
                    defaultMessage: 'HTML String',
                  })}
                </SingleSelectOption>
                <SingleSelectOption value="markdown">
                  {formatMessage({
                    id: 'tiptap-editor.settings.outputFormatMarkdown',
                    defaultMessage: 'Markdown String',
                  })}
                </SingleSelectOption>
              </SingleSelect>
            </Box>
          </Box>

          <Box style={{ minWidth: '320px', flex: 1 }}>
            <Typography variant="pi" fontWeight="bold">
              {formatMessage({
                id: 'tiptap-editor.settings.allowedIframeDomainsLabel',
                defaultMessage: 'Allowed Iframe Domains (comma-separated)',
              })}
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
            {formatMessage({
              id: 'tiptap-editor.settings.enableRelationalSyncLabel',
              defaultMessage:
                'Automatically sync embedded Media (<FieldName>Media) and Internal Links (<FieldName>Links)',
            })}
          </Checkbox>
        </Box>
      </Box>

      <Box padding={6} background="neutral0" shadow="filterShadow" hasRadius>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Typography variant="delta" tag="h2">
            {formatMessage({
              id: 'tiptap-editor.settings.presetMatrixTitle',
              defaultMessage: 'Preset Feature Matrix',
            })}
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
