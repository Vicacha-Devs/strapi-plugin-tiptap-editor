import { useState, useEffect } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  Badge,
  Box,
  Flex,
  Typography,
  Button,
  Divider,
  Field,
  SingleSelect,
  SingleSelectOption,
  Checkbox,
  Tabs,
  TextInput,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';
import {
  PRESET_FEATURE_KEYS,
  DEFAULT_RUNTIME_SETTINGS,
  BUILT_IN_PRESETS,
  isFeatureEnabled,
  type PresetFeatureKey,
  type TiptapRuntimeSettings,
  type TiptapOutputFormat,
} from '../../../shared/types';

interface FeatureCategoryDefinition {
  id: string;
  defaultTitle: string;
  features: PresetFeatureKey[];
}

const FEATURE_DEFAULT_LABELS: Record<PresetFeatureKey, string> = {
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strikethrough',
  underline: 'Underline',
  code: 'Inline Code',
  codeBlock: 'Code Block',
  blockquote: 'Blockquote',
  bulletList: 'Bullet List',
  orderedList: 'Numbered List',
  hardBreak: 'Line Break (Hard Break)',
  horizontalRule: 'Horizontal Rule',
  history: 'Undo / Redo History',
  heading: 'Headings (H1–H6)',
  link: 'External / URL Link',
  table: 'Tables',
  textAlign: 'Text Alignment',
  superscript: 'Superscript',
  subscript: 'Subscript',
  textColor: 'Text Color',
  highlightColor: 'Highlight Color',
  mediaLibrary: 'Strapi Media Library (Images)',
  fontFamily: 'Font Family',
  fontSize: 'Font Size',
  lineHeight: 'Line Height',
  clearFormatting: 'Clear Formatting',
  typography: 'Smart Typography',
  leadParagraph: 'Lead Paragraph',
  language: 'Language & Text Direction (WCAG)',
  abbr: 'Abbreviation (<abbr>)',
  video: 'Video Embed',
  audio: 'Audio & Voice Recorder',
  attachment: 'File Attachment',
  iframe: 'Sandboxed Iframe Embed',
  linker: 'Strapi Internal Entry Linker',
  informationPane: 'Information / Callout Pane',
  accordion: 'Collapsible Accordion (<details>)',
  conversationHistory: 'Conversation Thread Block',
  columns: 'Multi-Column Layout',
  taskList: 'Interactive Task Checklist',
  mathematics: 'Mathematical Formulas (LaTeX)',
  emoji: 'Emoji Picker',
  slashCommands: 'Slash Commands (/ Menu)',
  pageBreak: 'Page Break',
  tableOfContents: 'Table of Contents',
  speechToText: 'Voice Dictation (Speech-to-Text)',
  textToSpeech: 'Read Aloud (Text-to-Speech)',
  characterCount: 'Word & Character Counter',
  fullscreen: 'Fullscreen Mode',
};

const PRESET_DEFAULT_LABELS: Record<string, string> = {
  default: 'Default',
  minimal: 'Minimal',
  standard: 'Standard',
  editorial: 'Editorial',
  full: 'Full',
  edifice: 'Edifice',
};

const FEATURE_CATEGORIES: FeatureCategoryDefinition[] = [
  {
    id: 'formatting',
    defaultTitle: 'Text Formatting & Script',
    features: [
      'bold',
      'italic',
      'underline',
      'strike',
      'code',
      'superscript',
      'subscript',
      'clearFormatting',
    ],
  },
  {
    id: 'structure',
    defaultTitle: 'Headings, Paragraphs & Lists',
    features: [
      'heading',
      'leadParagraph',
      'blockquote',
      'codeBlock',
      'bulletList',
      'orderedList',
      'taskList',
      'horizontalRule',
      'hardBreak',
      'pageBreak',
    ],
  },
  {
    id: 'typography',
    defaultTitle: 'Typography, Colors & Accessibility',
    features: [
      'textAlign',
      'textColor',
      'highlightColor',
      'fontFamily',
      'fontSize',
      'lineHeight',
      'typography',
      'language',
      'abbr',
    ],
  },
  {
    id: 'media',
    defaultTitle: 'Links & Rich Media',
    features: [
      'link',
      'linker',
      'mediaLibrary',
      'video',
      'audio',
      'attachment',
      'iframe',
    ],
  },
  {
    id: 'blocks',
    defaultTitle: 'Structured & Interactive Blocks',
    features: [
      'table',
      'columns',
      'accordion',
      'informationPane',
      'tableOfContents',
      'mathematics',
      'conversationHistory',
    ],
  },
  {
    id: 'productivity',
    defaultTitle: 'Editor Tools, Voice & Productivity',
    features: [
      'history',
      'slashCommands',
      'emoji',
      'characterCount',
      'speechToText',
      'textToSpeech',
      'fullscreen',
    ],
  },
];

// Only surface features the editor currently supports.
const SUPPORTED_CATEGORIES = FEATURE_CATEGORIES.map((category) => ({
  ...category,
  features: category.features.filter((key) => PRESET_FEATURE_KEYS.includes(key)),
})).filter((category) => category.features.length > 0);

function formatFallbackPresetName(name: string): string {
  if (PRESET_DEFAULT_LABELS[name]) {
    return PRESET_DEFAULT_LABELS[name];
  }
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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
  const [availablePresets, setAvailablePresets] = useState<string[]>(Object.keys(BUILT_IN_PRESETS));
  const [basePreset, setBasePreset] = useState<Record<string, unknown>>(
    (BUILT_IN_PRESETS.default ?? {}) as Record<string, unknown>
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const getPresetLabel = (presetName: string): string =>
    formatMessage({
      id: `tiptap-editor.settings.presetName.${presetName}`,
      defaultMessage: formatFallbackPresetName(presetName),
    });

  const getFeatureLabel = (featureKey: PresetFeatureKey): string =>
    formatMessage({
      id: `tiptap-editor.settings.feature.${featureKey}`,
      defaultMessage: FEATURE_DEFAULT_LABELS[featureKey] ?? featureKey,
    });

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
        if (loaded.defaultPreset) {
          setSelectedPreset(loaded.defaultPreset);
        }
        setIframeDomainsInput((loaded.allowedIframeDomains || []).join(', '));
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [get]);

  useEffect(() => {
    let mounted = true;
    get('/tiptap-editor/presets?includeBuiltIn=true')
      .then((res: { data?: { presets?: string[] } }) => {
        if (mounted && Array.isArray(res?.data?.presets)) {
          setAvailablePresets(res.data.presets);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [get]);

  useEffect(() => {
    let mounted = true;
    get(`/tiptap-editor/presets/${encodeURIComponent(selectedPreset)}`)
      .then((res: { data?: Record<string, unknown> }) => {
        if (mounted) {
          setBasePreset(
            res?.data ?? ((BUILT_IN_PRESETS[selectedPreset] ?? {}) as Record<string, unknown>)
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setBasePreset((BUILT_IN_PRESETS[selectedPreset] ?? {}) as Record<string, unknown>);
        }
      });
    return () => {
      mounted = false;
    };
  }, [get, selectedPreset]);

  const currentPresetConfig: Record<string, unknown> = {
    ...(BUILT_IN_PRESETS[selectedPreset] ?? {}),
    ...basePreset,
    ...(settings.presetOverrides?.[selectedPreset] ?? {}),
  };

  const handleToggleFeature = (featureKey: PresetFeatureKey, enabled: boolean) => {
    const baseValue = (basePreset as Record<string, unknown>)[featureKey];
    const nextValue =
      enabled && baseValue && typeof baseValue === 'object'
        ? { ...(baseValue as Record<string, unknown>), enabled: true }
        : enabled;
    setSettings((prev) => ({
      ...prev,
      presetOverrides: {
        ...prev.presetOverrides,
        [selectedPreset]: {
          ...(prev.presetOverrides?.[selectedPreset] ?? {}),
          [featureKey]: nextValue,
        },
      },
    }));
  };

  const handleBulkToggleFeatures = (featureKeys: PresetFeatureKey[], enabled: boolean) => {
    setSettings((prev) => {
      const updatedPreset = { ...(prev.presetOverrides?.[selectedPreset] ?? {}) };
      for (const featureKey of featureKeys) {
        const baseValue = (basePreset as Record<string, unknown>)[featureKey];
        (updatedPreset as Record<string, unknown>)[featureKey] =
          enabled && baseValue && typeof baseValue === 'object'
            ? { ...(baseValue as Record<string, unknown>), enabled: true }
            : enabled;
      }
      return {
        ...prev,
        presetOverrides: {
          ...prev.presetOverrides,
          [selectedPreset]: updatedPreset,
        },
      };
    });
  };

  const handleResetPresetOverrides = () => {
    setSettings((prev) => {
      const nextOverrides = { ...(prev.presetOverrides || {}) };
      delete nextOverrides[selectedPreset];
      return {
        ...prev,
        presetOverrides: nextOverrides,
      };
    });
  };

  const handleSave = async () => {
    if (loadError) return;
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
    new Set([...availablePresets, ...Object.keys(settings.presetOverrides || {})])
  );

  const enabledFeaturesCount = PRESET_FEATURE_KEYS.filter((key) =>
    isFeatureEnabled(currentPresetConfig[key])
  ).length;

  return (
    <Box padding={8} background="neutral100">
      <Flex justifyContent="space-between" alignItems="center" marginBottom={6} wrap="wrap" gap={4}>
        <Box>
          <Typography variant="alpha" tag="h1">
            {formatMessage({
              id: 'tiptap-editor.settings.pageTitle',
              defaultMessage: 'Tiptap Editor Settings',
            })}
          </Typography>
          <Box marginTop={1}>
            <Typography variant="epsilon" textColor="neutral600">
              {formatMessage({
                id: 'tiptap-editor.settings.pageDescription',
                defaultMessage:
                  'Configure global defaults, relational sync, iframe security, and toolbar presets.',
              })}
            </Typography>
          </Box>
        </Box>
        <Button onClick={handleSave} loading={isSaving} disabled={loadError}>
          {formatMessage({
            id: 'tiptap-editor.settings.saveButton',
            defaultMessage: 'Save Settings',
          })}
        </Button>
      </Flex>

      {loadError && (
        <Box
          role="alert"
          padding={3}
          marginBottom={4}
          background="danger100"
          borderColor="danger200"
          hasRadius
        >
          <Typography textColor="danger700">
            {formatMessage({
              id: 'tiptap-editor.settings.loadError',
              defaultMessage:
                'Failed to load settings. Saving is disabled to prevent overwriting existing configuration.',
            })}
          </Typography>
        </Box>
      )}

      {saveMessage && (
        <Box
          role="status"
          padding={3}
          marginBottom={4}
          background="primary100"
          borderColor="primary200"
          hasRadius
        >
          <Typography textColor="primary700">{saveMessage}</Typography>
        </Box>
      )}

      <Tabs.Root defaultValue="global">
        <Tabs.List
          aria-label={formatMessage({
            id: 'tiptap-editor.settings.pageTitle',
            defaultMessage: 'Tiptap Editor Settings',
          })}
        >
          <Tabs.Trigger value="global">
            {formatMessage({
              id: 'tiptap-editor.settings.globalSectionTitle',
              defaultMessage: 'Global Configuration',
            })}
          </Tabs.Trigger>
          <Tabs.Trigger value="presets">
            {formatMessage({
              id: 'tiptap-editor.settings.presetMatrixTitle',
              defaultMessage: 'Preset Feature Matrix',
            })}{' '}
            ({enabledFeaturesCount}/{PRESET_FEATURE_KEYS.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="global">
          <Box
            padding={6}
            background="neutral0"
            shadow="filterShadow"
            hasRadius
          >
            <Box marginBottom={4}>
              <Typography variant="delta" tag="h2">
                {formatMessage({
                  id: 'tiptap-editor.settings.globalSectionTitle',
                  defaultMessage: 'Global Configuration',
                })}
              </Typography>
              <Box marginTop={1}>
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: 'tiptap-editor.settings.globalSectionSubtitle',
                    defaultMessage:
                      'Default editor behavior applied when a Rich Text field does not specify custom options.',
                  })}
                </Typography>
              </Box>
            </Box>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '20px',
                alignItems: 'start',
              }}
            >
              <Box>
                <Field.Root
                  name="defaultPreset"
                  hint={formatMessage({
                    id: 'tiptap-editor.settings.defaultPresetHint',
                    defaultMessage:
                      'Toolbar preset applied by default to new or unconfigured Tiptap fields.',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: 'tiptap-editor.settings.defaultPresetLabel',
                      defaultMessage: 'Default Preset',
                    })}
                  </Field.Label>
                  <SingleSelect
                    value={settings.defaultPreset}
                    onChange={(val: string | number) =>
                      setSettings((prev) => ({ ...prev, defaultPreset: String(val) }))
                    }
                  >
                    {presetNames.map((name) => (
                      <SingleSelectOption key={name} value={name}>
                        {getPresetLabel(name)}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                  <Field.Hint />
                </Field.Root>
              </Box>

              <Box>
                <Field.Root
                  name="defaultOutputFormat"
                  hint={formatMessage({
                    id: 'tiptap-editor.settings.defaultOutputFormatWarning',
                    defaultMessage:
                      'Warning: Changing this default changes the storage format of fields without an explicit outputFormat.',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: 'tiptap-editor.settings.defaultOutputFormatLabel',
                      defaultMessage: 'Default Output Format',
                    })}
                  </Field.Label>
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
                  <Field.Hint />
                </Field.Root>
              </Box>

              <Box>
                <Field.Root
                  name="allowedIframeDomains"
                  hint={formatMessage({
                    id: 'tiptap-editor.settings.allowedIframeDomainsHint',
                    defaultMessage:
                      'Comma-separated HTTPS hostnames allowed for embedded iframes (e.g., www.youtube.com, player.vimeo.com).',
                  })}
                >
                  <Field.Label>
                    {formatMessage({
                      id: 'tiptap-editor.settings.allowedIframeDomainsLabel',
                      defaultMessage: 'Allowed Iframe Domains (comma-separated)',
                    })}
                  </Field.Label>
                  <TextInput
                    name="allowedIframeDomains"
                    placeholder="www.youtube.com, player.vimeo.com"
                    value={iframeDomainsInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setIframeDomainsInput(e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>
              </Box>
            </div>

            <Box
              marginTop={5}
              padding={4}
              background="neutral100"
              borderColor="neutral200"
              hasRadius
            >
              <Checkbox
                checked={settings.enableRelationalSync}
                onCheckedChange={(checked: boolean) =>
                  setSettings((prev) => ({ ...prev, enableRelationalSync: Boolean(checked) }))
                }
              >
                {formatMessage({
                  id: 'tiptap-editor.settings.enableRelationalSyncLabel',
                  defaultMessage:
                    "Automatically sync embedded Media ('<FieldName>'Media) and Internal Links ('<FieldName>'Links)",
                })}
              </Checkbox>
            </Box>
          </Box>
        </Tabs.Content>

        <Tabs.Content value="presets">
          <Box padding={6} background="neutral0" shadow="filterShadow" hasRadius>
            <Flex
              justifyContent="space-between"
              alignItems="flex-start"
              marginBottom={4}
              wrap="wrap"
              gap={4}
            >
              <Box>
                <Flex alignItems="center" gap={3}>
                  <Typography variant="delta" tag="h2">
                    {formatMessage({
                      id: 'tiptap-editor.settings.presetMatrixTitle',
                      defaultMessage: 'Preset Feature Matrix',
                    })}
                  </Typography>
                  <Badge active={enabledFeaturesCount > 0}>
                    {formatMessage(
                      {
                        id: 'tiptap-editor.settings.enabledFeaturesCount',
                        defaultMessage: '{enabled} / {total} enabled',
                      },
                      {
                        enabled: enabledFeaturesCount,
                        total: PRESET_FEATURE_KEYS.length,
                      }
                    )}
                  </Badge>
                </Flex>
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({
                      id: 'tiptap-editor.settings.presetMatrixSubtitle',
                      defaultMessage:
                        'Toggle toolbar tools and extensions for the selected preset across all content types.',
                    })}
                  </Typography>
                </Box>
              </Box>

              <Flex alignItems="flex-end" gap={3} wrap="wrap">
                <Box style={{ minWidth: '220px' }}>
                  <Field.Root name="selectedPreset">
                    <Field.Label>
                      {formatMessage({
                        id: 'tiptap-editor.settings.presetMatrixSelectLabel',
                        defaultMessage: 'Select preset to configure',
                      })}
                    </Field.Label>
                    <SingleSelect
                      aria-label={formatMessage({
                        id: 'tiptap-editor.settings.presetMatrixSelectLabel',
                        defaultMessage: 'Select preset to configure',
                      })}
                      value={selectedPreset}
                      onChange={(val: string | number) => setSelectedPreset(String(val))}
                    >
                      {presetNames.map((name) => (
                        <SingleSelectOption key={name} value={name}>
                          {getPresetLabel(name)}
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                  </Field.Root>
                </Box>

                <Button
                  variant="secondary"
                  size="S"
                  onClick={() => handleBulkToggleFeatures([...PRESET_FEATURE_KEYS], true)}
                >
                  {formatMessage({
                    id: 'tiptap-editor.settings.enableAllFeatures',
                    defaultMessage: 'Enable All',
                  })}
                </Button>

                <Button
                  variant="tertiary"
                  size="S"
                  onClick={() => handleBulkToggleFeatures([...PRESET_FEATURE_KEYS], false)}
                >
                  {formatMessage({
                    id: 'tiptap-editor.settings.disableAllFeatures',
                    defaultMessage: 'Disable All',
                  })}
                </Button>

                {settings.presetOverrides?.[selectedPreset] && (
                  <Button
                    variant="danger-light"
                    size="S"
                    onClick={handleResetPresetOverrides}
                  >
                    {formatMessage({
                      id: 'tiptap-editor.settings.resetPresetOverrides',
                      defaultMessage: 'Reset Defaults',
                    })}
                  </Button>
                )}
              </Flex>
            </Flex>

            <Divider />

            <Box marginTop={4}>
              <Tabs.Root defaultValue={SUPPORTED_CATEGORIES[0].id}>
                <Tabs.List
                  aria-label={formatMessage({
                    id: 'tiptap-editor.settings.presetMatrixTitle',
                    defaultMessage: 'Preset Feature Matrix',
                  })}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${SUPPORTED_CATEGORIES.length}, minmax(0, 1fr))`,
                    alignItems: 'stretch',
                  }}
                >
                  {SUPPORTED_CATEGORIES.map((category) => {
                    const categoryEnabledCount = category.features.filter((key) =>
                      isFeatureEnabled(currentPresetConfig[key])
                    ).length;
                    return (
                      <Tabs.Trigger
                        key={category.id}
                        value={category.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          paddingBlock: '12px',
                          paddingInline: '12px',
                          minHeight: '64px',
                        }}
                      >
                        {formatMessage({
                          id: `tiptap-editor.settings.category.${category.id}`,
                          defaultMessage: category.defaultTitle,
                        })}{' '}
                        ({categoryEnabledCount}/{category.features.length})
                      </Tabs.Trigger>
                    );
                  })}
                </Tabs.List>

                {SUPPORTED_CATEGORIES.map((category) => {
                  const categoryEnabledCount = category.features.filter((key) =>
                    isFeatureEnabled(currentPresetConfig[key])
                  ).length;
                  const allCategoryEnabled =
                    categoryEnabledCount === category.features.length;

                  return (
                    <Tabs.Content key={category.id} value={category.id}>
                      <Box padding={4}>
                        <Flex
                          justifyContent="space-between"
                          alignItems="center"
                          marginBottom={3}
                          wrap="wrap"
                          gap={2}
                        >
                          <Flex alignItems="center" gap={2}>
                            <Typography variant="sigma" textColor="neutral700">
                              {formatMessage({
                                id: `tiptap-editor.settings.category.${category.id}`,
                                defaultMessage: category.defaultTitle,
                              })}
                            </Typography>
                            <Badge active={categoryEnabledCount > 0}>
                              {categoryEnabledCount} / {category.features.length}
                            </Badge>
                          </Flex>
                          <Button
                            variant="ghost"
                            size="S"
                            onClick={() =>
                              handleBulkToggleFeatures(
                                category.features,
                                !allCategoryEnabled
                              )
                            }
                          >
                            {allCategoryEnabled
                              ? formatMessage({
                                  id: 'tiptap-editor.settings.disableCategory',
                                  defaultMessage: 'Deselect category',
                                })
                              : formatMessage({
                                  id: 'tiptap-editor.settings.enableCategory',
                                  defaultMessage: 'Select category',
                                })}
                          </Button>
                        </Flex>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: '12px',
                          }}
                        >
                          {category.features.map((featureKey) => {
                            const isChecked = isFeatureEnabled(
                              currentPresetConfig[featureKey]
                            );
                            return (
                              <Box
                                key={featureKey}
                                padding={3}
                                background={isChecked ? 'primary100' : 'neutral100'}
                                borderColor={isChecked ? 'primary200' : 'neutral200'}
                                hasRadius
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked: boolean) =>
                                    handleToggleFeature(featureKey, Boolean(checked))
                                  }
                                >
                                  {getFeatureLabel(featureKey)}
                                </Checkbox>
                              </Box>
                            );
                          })}
                        </div>
                      </Box>
                    </Tabs.Content>
                  );
                })}
              </Tabs.Root>
            </Box>
          </Box>
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}

export default SettingsPage;
