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
import { MINIMAL_PRESET_CONFIG } from '../../shared/src/types';

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
});
