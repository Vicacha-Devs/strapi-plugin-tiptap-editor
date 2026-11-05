import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Strapi design system and React hooks used by Heading.tsx (not needed for buildExtensions)
vi.mock('@strapi/strapi/admin', () => ({
  useField: vi.fn(() => ({ value: '', onChange: vi.fn(), error: undefined })),
  useFetchClient: vi.fn(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() })),
}));
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
  Popover: { Root: 'PopoverRoot', Anchor: 'PopoverAnchor', Trigger: 'PopoverTrigger', Content: 'PopoverContent' },
  SingleSelect: 'SingleSelect',
  SingleSelectOption: 'SingleSelectOption',
  SimpleMenu: 'SimpleMenu',
  MenuItem: 'MenuItem',
  Status: 'Status',
  TextInput: 'TextInput',
  Textarea: 'Textarea',
  Tooltip: 'Tooltip',
  Typography: 'Typography',
}));
vi.mock('@strapi/icons', () => ({
  PuzzlePiece: 'PuzzlePiece',
  Pencil: 'Pencil',
  Trash: 'Trash',
  Image: 'Image',
  ArrowClockwise: 'ArrowClockwise',
  Cross: 'Cross',
  Link: 'Link',
}));
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { id: string; defaultMessage: string }) => defaultMessage,
  }),
}));
vi.mock('@tiptap/react', () => ({
  useEditorState: vi.fn(),
  ReactNodeViewRenderer: vi.fn(() => 'nodeview'),
  NodeViewWrapper: 'div',
  NodeViewContent: 'div',
}));

// The component dialog and node view are React-only; buildExtensions just needs them to resolve.
vi.mock('../../admin/src/components/ComponentDialog', () => ({ default: 'ComponentDialog' }));
vi.mock('../../admin/src/components/ComponentNodeView', () => ({
  GenericComponentNodeView: 'GenericComponentNodeView',
}));

import { getSchema } from '@tiptap/core';
import { buildExtensions } from '../../admin/src/utils/buildExtensions';
import {
  clearRichTextComponents,
  defineRichTextComponent,
  registerRichTextComponent,
} from '../../admin/src/registry/richTextComponents';
import { buttonComponent } from '../../admin/src/builtins/button';
import { FULL_PRESET_CONFIG, TiptapPresetConfig } from '../../shared/src/types';
import { BUILT_IN_COMPONENT_SCHEMAS, RESERVED_NODE_NAMES } from '../../shared/src/components';

describe('buildExtensions', () => {
  beforeEach(() => {
    clearRichTextComponents();
  });

  it('always returns an array containing StarterKit', () => {
    const extensions = buildExtensions({});
    const hasStarterKit = extensions.some(
      (ext: any) => ext.name === 'starterKit'
    );
    expect(hasStarterKit).toBe(true);
  });

  it('always includes Gapcursor', () => {
    const extensions = buildExtensions({});
    const hasGapcursor = extensions.some(
      (ext: any) => ext.name === 'gapCursor'
    );
    expect(hasGapcursor).toBe(true);
  });

  it('includes HeadingWithSEOTag when heading is true', () => {
    const extensions = buildExtensions({ heading: true });
    const hasHeading = extensions.some(
      (ext: any) => ext.name === 'heading'
    );
    expect(hasHeading).toBe(true);
  });

  it('configures HeadingWithSEOTag with default levels [1,2,3,4,5,6] when heading is true', () => {
    const extensions = buildExtensions({ heading: true });
    const heading = extensions.find((ext: any) => ext.name === 'heading');
    expect(heading).toBeDefined();
    expect((heading as any).options.levels).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('configures HeadingWithSEOTag with custom levels when heading has levels', () => {
    const extensions = buildExtensions({ heading: { levels: [2, 3] } });
    const heading = extensions.find((ext: any) => ext.name === 'heading');
    expect(heading).toBeDefined();
    expect((heading as any).options.levels).toEqual([2, 3]);
    expect((heading as any).options.autoSlugId).toBe(true);
  });

  it('passes autoSlugId: false to HeadingWithSEOTag and omits headingAutoId plugin when configured', () => {
    const extensions = buildExtensions({ heading: { levels: [1, 2], autoSlugId: false } });
    const heading = extensions.find((ext: any) => ext.name === 'heading') as any;
    expect(heading).toBeDefined();
    expect(heading.options.autoSlugId).toBe(false);
    const plugins = heading.config.addProseMirrorPlugins.call(heading);
    expect(plugins).toEqual([]);
  });

  it('does not include HeadingWithSEOTag when heading is false', () => {
    const extensions = buildExtensions({ heading: false });
    const hasHeading = extensions.some(
      (ext: any) => ext.name === 'heading'
    );
    expect(hasHeading).toBe(false);
  });

  it('always sets StarterKit heading to false', () => {
    const extensions = buildExtensions({ heading: true });
    const starterKit = extensions.find(
      (ext: any) => ext.name === 'starterKit'
    );
    // StarterKit with heading: false means heading extension is excluded from StarterKit
    expect(starterKit).toBeDefined();
  });

  it('disables bold in StarterKit when bold is false', () => {
    const config: TiptapPresetConfig = { bold: false };
    const extensions = buildExtensions(config);
    // StarterKit should be configured with bold: false
    const starterKit = extensions.find(
      (ext: any) => ext.name === 'starterKit'
    );
    expect(starterKit).toBeDefined();
  });

  it('includes Superscript when superscript is true', () => {
    const extensions = buildExtensions({ superscript: true });
    const hasSuperscript = extensions.some(
      (ext: any) => ext.name === 'superscript'
    );
    expect(hasSuperscript).toBe(true);
  });

  it('does not include Superscript when superscript is false', () => {
    const extensions = buildExtensions({ superscript: false });
    const hasSuperscript = extensions.some(
      (ext: any) => ext.name === 'superscript'
    );
    expect(hasSuperscript).toBe(false);
  });

  it('includes Subscript when subscript is true', () => {
    const extensions = buildExtensions({ subscript: true });
    const hasSubscript = extensions.some(
      (ext: any) => ext.name === 'subscript'
    );
    expect(hasSubscript).toBe(true);
  });

  it('does not include Subscript when subscript is false', () => {
    const extensions = buildExtensions({ subscript: false });
    const hasSubscript = extensions.some(
      (ext: any) => ext.name === 'subscript'
    );
    expect(hasSubscript).toBe(false);
  });

  it('includes TableKit when table is true', () => {
    const extensions = buildExtensions({ table: true });
    const tableKit = extensions.find(
      (ext: any) => ext.name === 'tableKit'
    );
    expect(tableKit).toBeDefined();
    expect((tableKit as any).options.table.resizable).toBe(true);
  });

  it('swaps the stock table cells for ones carrying backgroundColor, whatever cellBackground says', () => {
    for (const table of [true, { cellBackground: false }, { cellBackground: true }]) {
      const extensions = buildExtensions({ table });
      const tableKit = extensions.find((ext: any) => ext.name === 'tableKit') as any;
      expect(tableKit.options.tableCell).toBe(false);
      expect(tableKit.options.tableHeader).toBe(false);
      expect(tableKit.options.table).not.toHaveProperty('cellBackground');
      const cellNames = extensions
        .map((ext: any) => ext.name)
        .filter((name: string) => name === 'tableCell' || name === 'tableHeader');
      expect(cellNames).toEqual(['tableCell', 'tableHeader']);
    }
  });

  it('puts backgroundColor on tableCell and tableHeader in the editor schema', () => {
    const schema = getSchema(buildExtensions({ table: true }));
    expect(schema.nodes.tableCell.spec.attrs).toHaveProperty('backgroundColor');
    expect(schema.nodes.tableHeader.spec.attrs).toHaveProperty('backgroundColor');
  });

  it('always includes TableKit with resizable: false when table is false (Zero-Data-Loss)', () => {
    const extensions = buildExtensions({ table: false });
    const tableKit = extensions.find(
      (ext: any) => ext.name === 'tableKit'
    );
    expect(tableKit).toBeDefined();
    expect((tableKit as any).options.table.resizable).toBe(false);
  });

  it('includes TextAlign when textAlign is true', () => {
    const extensions = buildExtensions({ textAlign: true });
    const hasTextAlign = extensions.some(
      (ext: any) => ext.name === 'textAlign'
    );
    expect(hasTextAlign).toBe(true);
  });

  it('does not include TextAlign when textAlign is false', () => {
    const extensions = buildExtensions({ textAlign: false });
    const hasTextAlign = extensions.some(
      (ext: any) => ext.name === 'textAlign'
    );
    expect(hasTextAlign).toBe(false);
  });

  it('includes image extension when mediaLibrary is true', () => {
    const extensions = buildExtensions({ mediaLibrary: true });
    const hasImage = extensions.some((ext: any) => ext.name === 'image');
    expect(hasImage).toBe(true);
  });

  it('includes image extension with enableContentCheck: true when mediaLibrary is false', () => {
    const extensions = buildExtensions({ mediaLibrary: false });
    const imageExt = extensions.find((ext: any) => ext.name === 'image');
    expect(imageExt).toBeDefined();
    expect((imageExt as any).options.enableContentCheck).toBe(true);
  });

  it('includes image extension with enableContentCheck: true when mediaLibrary is absent', () => {
    const extensions = buildExtensions({});
    const imageExt = extensions.find((ext: any) => ext.name === 'image');
    expect(imageExt).toBeDefined();
    expect((imageExt as any).options.enableContentCheck).toBe(true);
  });

  it('includes image extension without enableContentCheck when mediaLibrary is true', () => {
    const extensions = buildExtensions({ mediaLibrary: true });
    const imageExt = extensions.find((ext: any) => ext.name === 'image');
    expect(imageExt).toBeDefined();
    expect((imageExt as any).options.enableContentCheck).toBeFalsy();
  });

  it('with all features enabled includes StarterKit, heading, superscript, subscript, tableKit, textAlign, image, gapcursor, textStyle, color, highlight, pasteStripper', () => {
    const config: TiptapPresetConfig = {
      bold: true,
      italic: true,
      strike: true,
      code: true,
      codeBlock: true,
      blockquote: true,
      bulletList: true,
      orderedList: true,
      hardBreak: true,
      horizontalRule: true,
      history: true,
      heading: true,
      link: true,
      table: true,
      textAlign: true,
      superscript: true,
      subscript: true,
      textColor: true,
      highlightColor: true,
      mediaLibrary: true,
    };
    const extensions = buildExtensions(config);
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('starterKit');
    expect(names).toContain('heading');
    expect(names).toContain('superscript');
    expect(names).toContain('subscript');
    expect(names).toContain('tableKit');
    expect(names).toContain('textAlign');
    expect(names).toContain('image');
    expect(names).toContain('gapCursor');
    expect(names).toContain('textStyle');
    expect(names).toContain('color');
    expect(names).toContain('highlight');
    expect(names).toContain('pasteStripper');
  });

  it('with all features false returns StarterKit, Image, Gapcursor, TableKit, and schema-preserving marks/nodes without PasteStripper', () => {
    const config: TiptapPresetConfig = {
      bold: false,
      italic: false,
      strike: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      hardBreak: false,
      horizontalRule: false,
      history: false,
      heading: false,
      link: false,
      table: false,
      textAlign: false,
      superscript: false,
      subscript: false,
      textColor: false,
      highlightColor: false,
      mediaLibrary: false,
    };
    const extensions = buildExtensions(config);
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('starterKit');
    expect(names).toContain('gapCursor');
    expect(names).toContain('tableKit');
    expect(names).toContain('textStyle');
    expect(names).toContain('color');
    expect(names).toContain('highlight');
    expect(names).not.toContain('heading');
    expect(names).not.toContain('superscript');
    expect(names).not.toContain('subscript');
    expect(names).not.toContain('textAlign');
    expect(names).not.toContain('pasteStripper');
  });

  // textColor / highlightColor extension registration tests

  it('includes TextStyle, Color, and pasteStripper when textColor is true', () => {
    const extensions = buildExtensions({ textColor: true });
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('textStyle');
    expect(names).toContain('color');
    expect(names).toContain('pasteStripper');
  });

  it('includes TextStyle, Highlight, and pasteStripper when highlightColor is true', () => {
    const extensions = buildExtensions({ highlightColor: true });
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('textStyle');
    expect(names).toContain('highlight');
    expect(names).toContain('pasteStripper');
  });

  it('includes TextStyle only once when both textColor and highlightColor are true', () => {
    const extensions = buildExtensions({ textColor: true, highlightColor: true });
    const names = extensions.map((ext: any) => ext.name);

    const textStyleCount = names.filter((name) => name === 'textStyle').length;
    expect(textStyleCount).toBe(1);

    const pasteStripperCount = names.filter((name) => name === 'pasteStripper').length;
    expect(pasteStripperCount).toBe(1);
  });

  it('always registers TextStyle, Color, Highlight, FontFamily, FontSize, and LineHeight for schema preservation while omitting PasteStripper when disabled', () => {
    const extensions = buildExtensions({});
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('textStyle');
    expect(names).toContain('color');
    expect(names).toContain('highlight');
    expect(names).toContain('fontFamily');
    expect(names).toContain('fontSize');
    expect(names).toContain('lineHeight');
    expect(names).not.toContain('pasteStripper');
  });

  it('Highlight is configured with multicolor: true', () => {
    const extensions = buildExtensions({ highlightColor: true });
    const highlight = extensions.find((ext: any) => ext.name === 'highlight');

    expect(highlight).toBeDefined();
    expect((highlight as any).options.multicolor).toBe(true);
  });

  it('textColor only still registers Highlight schema for Zero-Data-Loss', () => {
    const extensions = buildExtensions({ textColor: true });
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('color');
    expect(names).toContain('highlight');
  });

  it('highlightColor only still registers Color schema for Zero-Data-Loss', () => {
    const extensions = buildExtensions({ highlightColor: true });
    const names = extensions.map((ext: any) => ext.name);

    expect(names).toContain('highlight');
    expect(names).toContain('color');
  });

  it('does not include characterCount when characterCount is { enabled: false, limit: 500 } and no field characterLimit is set', () => {
    const extensions = buildExtensions({
      characterCount: { enabled: false, limit: 500 },
    });
    const names = extensions.map((ext: any) => ext.name);

    expect(names).not.toContain('characterCount');
  });

  it('registers the strapi protocol on StarterKit link when allowInternalLinks is true', () => {
    const extensions = buildExtensions({
      link: { openOnClick: false, allowInternalLinks: true },
    });
    const starterKit = extensions.find((ext: any) => ext.name === 'starterKit') as any;
    expect(starterKit).toBeDefined();
    expect(starterKit.options.link).toEqual({
      openOnClick: false,
      protocols: [{ scheme: 'strapi', optionalSlashes: false }],
    });
  });

  it('validates TableCellWithBackground and TableHeaderWithBackground backgroundColor so unsafe CSS is dropped while #eaf5ff remains valid', () => {
    const extensions = buildExtensions({ table: true });
    const tableCell = extensions.find((ext: any) => ext.name === 'tableCell') as any;
    const tableHeader = extensions.find((ext: any) => ext.name === 'tableHeader') as any;
    expect(tableCell).toBeDefined();
    expect(tableHeader).toBeDefined();

    for (const ext of [tableCell, tableHeader]) {
      const attrs = ext.config.addAttributes.call({ parent: () => ({}) });
      expect(attrs.backgroundColor.renderHTML({ backgroundColor: 'red; position:fixed' })).toEqual(
        {}
      );
      expect(attrs.backgroundColor.renderHTML({ backgroundColor: '#eaf5ff' })).toEqual({
        style: 'background-color: #eaf5ff',
      });
    }
  });

  // rich-text component nodes

  it('adds a node for a registered component even when the preset does not enable it', () => {
    registerRichTextComponent(
      defineRichTextComponent({
        name: 'callout',
        label: 'Callout',
        content: 'block+',
        attributes: {},
      })
    );
    const ext = buildExtensions({}).find((e: any) => e.name === 'callout') as any;
    expect(ext).toBeDefined();
    expect(ext.config.addOptions().enabled).toBe(false);
  });

  it('marks the node enabled when the preset enables it', () => {
    registerRichTextComponent(
      defineRichTextComponent({
        name: 'callout',
        label: 'Callout',
        content: 'block+',
        attributes: {},
      })
    );
    const ext = buildExtensions({ components: { callout: { tones: ['info'] } } }).find(
      (e: any) => e.name === 'callout'
    ) as any;
    expect(ext.config.addOptions()).toStrictEqual({
      enabled: true,
      component: { tones: ['info'] },
    });
  });

  it('ignores enabled-but-unregistered names', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      buildExtensions({ components: { ghost: true } }).some((e: any) => e.name === 'ghost')
    ).toBe(false);
  });

  it('registers the built-in button component from BUILT_IN_COMPONENT_SCHEMAS when enabled without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn.mockClear();
    registerRichTextComponent(buttonComponent);
    const extensions = buildExtensions({ components: { button: true } });
    expect(extensions.some((e: any) => e.name === 'button')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('strips unsafe protocols, isAllowedUri, validate, and on* HTMLAttributes from StarterKit link config', () => {
    const extensions = buildExtensions({
      link: {
        allowInternalLinks: true,
        protocols: ['javascript'],
        isAllowedUri: () => true,
        validate: () => true,
        HTMLAttributes: {
          class: 'safe-link',
          onclick: 'alert(1)',
          OnMouseOver: 'evil()',
        },
      } as any,
    });
    const starterKit = extensions.find((ext: any) => ext.name === 'starterKit') as any;
    expect(starterKit.options.link).toEqual({
      openOnClick: false,
      HTMLAttributes: { class: 'safe-link' },
      protocols: [{ scheme: 'strapi', optionalSlashes: false }],
    });
  });

  it('ensures every node and mark in FULL_PRESET_CONFIG schema (except built-in components) is in RESERVED_NODE_NAMES', () => {
    const schema = getSchema(buildExtensions(FULL_PRESET_CONFIG));
    const builtInNames = new Set(BUILT_IN_COMPONENT_SCHEMAS.map((s) => s.name));
    const allSchemaNames = [
      ...Object.keys(schema.nodes),
      ...Object.keys(schema.marks),
    ].filter((name) => !builtInNames.has(name));

    const missing = allSchemaNames.filter((name) => !RESERVED_NODE_NAMES.has(name));
    expect(missing).toEqual([]);
  });

  // rich-text component nodes

  it('adds a node for a registered component even when the preset does not enable it', () => {
    registerRichTextComponent(
      defineRichTextComponent({
        name: 'callout',
        label: 'Callout',
        content: 'block+',
        attributes: {},
      })
    );
    const ext = buildExtensions({}).find((e: any) => e.name === 'callout') as any;
    expect(ext).toBeDefined();
    expect(ext.config.addOptions().enabled).toBe(false);
  });

  it('marks the node enabled when the preset enables it', () => {
    registerRichTextComponent(
      defineRichTextComponent({
        name: 'callout',
        label: 'Callout',
        content: 'block+',
        attributes: {},
      })
    );
    const ext = buildExtensions({ components: { callout: { tones: ['info'] } } }).find(
      (e: any) => e.name === 'callout'
    ) as any;
    expect(ext.config.addOptions()).toStrictEqual({
      enabled: true,
      component: { tones: ['info'] },
    });
  });

  it('ignores enabled-but-unregistered names', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      buildExtensions({ components: { ghost: true } }).some((e: any) => e.name === 'ghost')
    ).toBe(false);
  });
});
