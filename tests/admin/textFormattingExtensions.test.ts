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

vi.mock('@strapi/icons', () => ({
  Bold: 'Bold',
  Italic: 'Italic',
  Underline: 'Underline',
  StrikeThrough: 'StrikeThrough',
  Code: 'Code',
  Quotes: 'Quotes',
  BulletList: 'BulletList',
  NumberList: 'NumberList',
  Link: 'Link',
  Image: 'Image',
  Cross: 'Cross',
  Check: 'Check',
  Plus: 'Plus',
  Minus: 'Minus',
}));

vi.mock('@strapi/strapi/admin', () => ({
  useField: vi.fn(() => ({ value: '', onChange: vi.fn(), error: undefined })),
  useFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() })),
}));

import { buildExtensions } from '../../admin/src/utils/buildExtensions';
import { PRESET_FEATURE_KEYS } from '../../shared/src/types';
import { slugifyHeadingText } from '../../admin/src/extensions/Heading';

const names = (config: Record<string, unknown>) =>
  buildExtensions(config as any).map((ext: any) => ext.name);

describe('text formatting extensions', () => {
  it('exposes the typography and semantic preset keys', () => {
    for (const key of [
      'fontFamily',
      'fontSize',
      'lineHeight',
      'clearFormatting',
      'typography',
      'leadParagraph',
      'language',
      'abbr',
    ]) {
      expect(PRESET_FEATURE_KEYS).toContain(key);
    }
  });

  it('drops unsafe table cell background colors', () => {
    const extensions = buildExtensions({ table: true } as any);
    for (const name of ['tableCell', 'tableHeader']) {
      const ext = extensions.find((e: any) => e.name === name) as any;
      expect(ext).toBeDefined();
      const attrs = ext.config.addAttributes.call({ parent: () => ({}) });
      expect(attrs.backgroundColor.renderHTML({ backgroundColor: 'red; position:fixed' })).toEqual({});
      expect(attrs.backgroundColor.renderHTML({ backgroundColor: '#eaf5ff' })).toEqual({
        style: 'background-color: #eaf5ff',
      });
    }
  });

  it('slugifyHeadingText preserves Unicode letters while stripping diacritics and punctuation', () => {
    expect(slugifyHeadingText('Café & Résumé!')).toBe('cafe-resume');
    expect(slugifyHeadingText('日本語の見出し 2026')).toBe('日本語の見出し-2026');
    expect(slugifyHeadingText('Заголовок раздела')).toBe('заголовок-раздела');
  });
});
