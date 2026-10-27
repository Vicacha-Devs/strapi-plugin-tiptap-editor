import { describe, it, expect, vi } from 'vitest';

vi.mock('@strapi/design-system', () => ({
  Box: 'Box',
  Button: 'Button',
  Dialog: { Root: 'DialogRoot', Content: 'DialogContent', Header: 'DialogHeader', Body: 'DialogBody', Footer: 'DialogFooter', Cancel: 'DialogCancel', Action: 'DialogAction' },
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

vi.mock('@strapi/icons', () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? false : String(name)) }));

vi.mock('@strapi/strapi/admin', () => ({
  useField: vi.fn(() => ({ value: '', onChange: vi.fn(), error: undefined })),
  useFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() })),
}));

import { MINIMAL_PRESET_CONFIG, PRESET_FEATURE_KEYS } from '../../shared/types';
import { buildExtensions } from '../../admin/src/utils/buildExtensions';
import { calculateReadingTimeMinutes } from '../../admin/src/components/EditorFooterAndModes';

const names = (exts: Array<{ name?: string }>) => exts.map((ext) => ext?.name).filter(Boolean);

describe('structured blocks & productivity tools', () => {
  it('registers structured block schemas even in MINIMAL_PRESET_CONFIG (Zero-Data-Loss)', () => {
    const extNames = names(buildExtensions(MINIMAL_PRESET_CONFIG) as Array<{ name?: string }>);
    for (const name of [
      'informationPane',
      'mathematics',
      'details',
      'detailsSummary',
      'detailsContent',
      'conversationHistory',
      'layoutContainer',
      'layoutColumn',
      'taskList',
      'taskItem',
      'pageBreak',
      'tableOfContents',
      'characterCount',
    ]) {
      expect(extNames).toContain(name);
    }
  });

  it('omits characterCount when explicitly disabled and no characterLimit is given', () => {
    const disabled = names(
      buildExtensions({ ...MINIMAL_PRESET_CONFIG, characterCount: false }) as Array<{ name?: string }>
    );
    expect(disabled).not.toContain('characterCount');

    const objDisabled = names(
      buildExtensions({
        ...MINIMAL_PRESET_CONFIG,
        characterCount: { enabled: false, limit: 500 },
      } as never) as Array<{ name?: string }>
    );
    expect(objDisabled).not.toContain('characterCount');
  });

  it('keeps characterCount when a field-level characterLimit is provided', () => {
    const extNames = names(
      buildExtensions({ ...MINIMAL_PRESET_CONFIG, characterCount: false }, { characterLimit: 100 }) as Array<{
        name?: string;
      }>
    );
    expect(extNames).toContain('characterCount');
  });

  it('adds the emoji shortcode extension only when emoji is enabled', () => {
    const on = buildExtensions({ ...MINIMAL_PRESET_CONFIG, emoji: true }).length;
    const off = buildExtensions({ ...MINIMAL_PRESET_CONFIG }).length;
    expect(on).toBe(off + 1);
  });

  it('exposes the new preset feature keys', () => {
    for (const key of ['informationPane', 'accordion', 'columns', 'taskList', 'slashCommands', 'fullscreen']) {
      expect(PRESET_FEATURE_KEYS).toContain(key);
    }
  });

  describe('calculateReadingTimeMinutes', () => {
    it('returns 0 minutes when wordCount is 0 or negative', () => {
      expect(calculateReadingTimeMinutes(0)).toBe(0);
      expect(calculateReadingTimeMinutes(-10)).toBe(0);
    });

    it('calculates reading time at 200 WPM by default and rounds up to at least 1 minute', () => {
      expect(calculateReadingTimeMinutes(1)).toBe(1);
      expect(calculateReadingTimeMinutes(200)).toBe(1);
      expect(calculateReadingTimeMinutes(201)).toBe(2);
    });

    it('supports custom wordsPerMinute and falls back to 200 WPM when invalid', () => {
      expect(calculateReadingTimeMinutes(300, 150)).toBe(2);
      expect(calculateReadingTimeMinutes(300, 0)).toBe(2);
    });
  });
});
