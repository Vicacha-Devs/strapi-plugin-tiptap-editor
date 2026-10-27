import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@strapi/design-system', () => ({
  Box: 'Box',
  Button: 'Button',
  Dialog: {
    Root: 'DialogRoot',
    Content: 'DialogContent',
    Header: 'DialogHeader',
    Body: 'DialogBody',
    Footer: 'DialogFooter',
    Cancel: 'DialogCancel',
    Action: 'DialogAction',
  },
  Field: { Root: 'FieldRoot', Label: 'FieldLabel', Hint: 'FieldHint', Error: 'FieldError' },
  Flex: 'Flex',
  IconButton: 'IconButton',
  Popover: { Root: 'PopoverRoot', Trigger: 'PopoverTrigger', Content: 'PopoverContent' },
  SingleSelect: 'SingleSelect',
  SingleSelectOption: 'SingleSelectOption',
  TextInput: 'TextInput',
  Textarea: 'Textarea',
  Tooltip: 'Tooltip',
  Typography: 'Typography',
}));
vi.mock('@strapi/strapi/admin', () => ({
  useField: vi.fn(() => ({ value: '', onChange: vi.fn(), error: undefined })),
  useFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() })),
}));
vi.mock('@tiptap/react', () => ({
  useEditorState: vi.fn(),
  ReactNodeViewRenderer: vi.fn(),
  NodeViewWrapper: 'div',
  NodeViewContent: 'div',
}));

import { Extension } from '@tiptap/core';
import {
  clearRegisteredTiptapExtensions,
  getRegisteredTiptapExtension,
  getRegisteredTiptapExtensions,
  isCustomExtensionEnabledForPreset,
  registerTiptapExtension,
  unregisterTiptapExtension,
} from '../../admin/src/utils/customExtensionRegistry';
import { buildExtensions } from '../../admin/src/utils/buildExtensions';
import { MINIMAL_PRESET_CONFIG } from '../../shared/types';

describe('customExtensionRegistry', () => {
  afterEach(() => {
    clearRegisteredTiptapExtensions();
  });

  it('registers, retrieves, and unregisters custom extensions', () => {
    const DummyExtension = Extension.create({ name: 'dummyTestExtension' });

    const cleanup = registerTiptapExtension({
      id: 'quran-ayah',
      label: 'Quran Ayah Block',
      extensions: DummyExtension,
    });

    expect(getRegisteredTiptapExtensions()).toHaveLength(1);
    expect(getRegisteredTiptapExtension('quran-ayah')?.label).toBe('Quran Ayah Block');

    expect(unregisterTiptapExtension('quran-ayah')).toBe(true);
    expect(getRegisteredTiptapExtensions()).toHaveLength(0);
    expect(unregisterTiptapExtension('non-existent')).toBe(false);
    cleanup();
  });

  it('throws when registering an extension with an empty id', () => {
    expect(() =>
      registerTiptapExtension({
        id: '   ',
        label: 'Invalid',
        extensions: [],
      })
    ).toThrow(/non-empty string `id`/);
  });

  it('evaluates preset enablement with defaultEnabled and customExtensions or featureKey overrides', () => {
    const enabledByDefault = {
      id: 'ext-enabled',
      label: 'Enabled By Default',
      defaultEnabled: true,
      extensions: [],
    };
    const disabledByDefault = {
      id: 'ext-disabled',
      label: 'Disabled By Default',
      defaultEnabled: false,
      extensions: [],
    };

    expect(isCustomExtensionEnabledForPreset(enabledByDefault, MINIMAL_PRESET_CONFIG)).toBe(true);
    expect(isCustomExtensionEnabledForPreset(disabledByDefault, MINIMAL_PRESET_CONFIG)).toBe(false);

    const overriddenConfig = {
      ...MINIMAL_PRESET_CONFIG,
      customExtensions: {
        'ext-enabled': false,
        'ext-disabled': { enabled: true, defaultStyle: 'card' },
      },
    };

    expect(isCustomExtensionEnabledForPreset(enabledByDefault, overriddenConfig)).toBe(false);
    expect(isCustomExtensionEnabledForPreset(disabledByDefault, overriddenConfig)).toBe(true);
  });

  it('includes enabled custom extensions in buildExtensions(config)', () => {
    const QuranAyahExtension = Extension.create({ name: 'quranAyahCustomNode' });
    const PrayerTimeExtension = Extension.create({ name: 'prayerTimeCustomNode' });

    registerTiptapExtension({
      id: 'quran-ayah',
      label: 'Quran Ayah',
      extensions: QuranAyahExtension,
    });

    registerTiptapExtension({
      id: 'prayer-time',
      label: 'Prayer Time Widget',
      defaultEnabled: false,
      extensions: () => [PrayerTimeExtension],
    });

    const defaultBuilt = buildExtensions(MINIMAL_PRESET_CONFIG);
    const defaultNames = defaultBuilt.map((ext) => ext.name);
    expect(defaultNames).toContain('quranAyahCustomNode');
    expect(defaultNames).not.toContain('prayerTimeCustomNode');

    const customPresetBuilt = buildExtensions({
      ...MINIMAL_PRESET_CONFIG,
      customExtensions: {
        'quran-ayah': false,
        'prayer-time': true,
      },
    });
    const customNames = customPresetBuilt.map((ext) => ext.name);
    expect(customNames).not.toContain('quranAyahCustomNode');
    expect(customNames).toContain('prayerTimeCustomNode');
  });
});
