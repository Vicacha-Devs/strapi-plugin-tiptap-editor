import { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Underline from '@tiptap/extension-underline';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Gapcursor } from '@tiptap/extensions';
import { TextStyle, Color, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { BaseHeadingWithSEOTag } from '../extensions/Heading';
import { PasteStripper } from '../extensions/PasteStripper';
import { StrapiImage } from '../extensions/Image';
import { SmartTypographyExtension } from '../extensions/TypographyControls';
import { LeadParagraph, LanguageMark, AbbrMark } from '../extensions/SemanticMarks';
import { TiptapPresetConfig, isFeatureEnabled, getFeatureOptions } from '../../../shared/types';

// Custom TableCell & TableHeader with backgroundColor support
const SAFE_CSS_COLOR =
  /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/-]+\)|var\(--[\w-]+\)|[a-z]+)$/i;

const toSafeColor = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value && SAFE_CSS_COLOR.test(value) ? value : null;
};

const backgroundColorAttribute = {
  default: null,
  parseHTML: (el: HTMLElement) =>
    toSafeColor(el.getAttribute('data-background-color') || el.style?.backgroundColor),
  renderHTML: (attrs: Record<string, unknown>) => {
    const color = toSafeColor(attrs.backgroundColor);
    if (!color) return {};
    return {
      'data-background-color': color,
      style: `background-color: ${color}`,
    };
  },
};

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...(this as any).parent?.(),
      backgroundColor: backgroundColorAttribute,
    };
  },
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...(this as any).parent?.(),
      backgroundColor: backgroundColorAttribute,
    };
  },
});

// Helper: converts a preset feature value to StarterKit's expected format
// false = disable the sub-extension, {} = enable with defaults
const starterKitFeatureValue = (
  value: TiptapPresetConfig[keyof TiptapPresetConfig]
): false | Record<string, unknown> => {
  if (!isFeatureEnabled(value)) {
    return false;
  }
  return getFeatureOptions(value, {}) ?? {};
};

export function buildExtensions(config: TiptapPresetConfig): Extensions {
  const starterKitConfig: Record<string, unknown> = {
    heading: false as const, // ALWAYS false — heading handled separately via BaseHeadingWithSEOTag
    bold: starterKitFeatureValue(config.bold),
    italic: starterKitFeatureValue(config.italic),
    strike: starterKitFeatureValue(config.strike),
    code: starterKitFeatureValue(config.code),
    codeBlock: starterKitFeatureValue(config.codeBlock),
    blockquote: starterKitFeatureValue(config.blockquote),
    bulletList: starterKitFeatureValue(config.bulletList),
    orderedList: starterKitFeatureValue(config.orderedList),
    hardBreak: starterKitFeatureValue(config.hardBreak),
    horizontalRule: starterKitFeatureValue(config.horizontalRule),
    history: starterKitFeatureValue(config.history),
    link: !isFeatureEnabled(config.link)
      ? false
      : {
          openOnClick: false,
          ...getFeatureOptions(config.link, {}),
        },
  };

  const extensions: Extensions = [StarterKit.configure(starterKitConfig)];

  if (isFeatureEnabled(config.heading)) {
    const headingConfig = getFeatureOptions(config.heading, {
      levels: [1, 2, 3, 4, 5, 6] as const,
      autoSlugId: true,
    });
    const levels = headingConfig?.levels || [1, 2, 3, 4, 5, 6];
    extensions.push(
      BaseHeadingWithSEOTag.configure({
        levels,
        autoSlugId: (headingConfig as { autoSlugId?: boolean })?.autoSlugId ?? true,
      } as any)
    );
  }

  if (isFeatureEnabled(config.underline)) {
    extensions.push(Underline);
  }

  if (isFeatureEnabled(config.superscript)) {
    extensions.push(Superscript);
  }

  if (isFeatureEnabled(config.subscript)) {
    extensions.push(Subscript);
  }

  if (isFeatureEnabled(config.table)) {
    extensions.push(
      TableKit.configure({
        table: {
          resizable: true,
          ...getFeatureOptions(config.table, {}),
        },
        tableCell: false,
        tableHeader: false,
      }),
      CustomTableCell,
      CustomTableHeader
    );
  }

  if (isFeatureEnabled(config.textAlign)) {
    const textAlignConfig = getFeatureOptions(config.textAlign, {
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    });
    extensions.push(
      TextAlign.configure({
        types: textAlignConfig?.types || ['heading', 'paragraph'],
        alignments: textAlignConfig?.alignments || ['left', 'center', 'right', 'justify'],
      })
    );
  }

  const needsTextStyle =
    isFeatureEnabled(config.textColor) ||
    isFeatureEnabled(config.highlightColor) ||
    isFeatureEnabled(config.fontFamily) ||
    isFeatureEnabled(config.fontSize) ||
    isFeatureEnabled(config.lineHeight);
  if (needsTextStyle) {
    extensions.push(TextStyle);
    extensions.push(PasteStripper);
  }
  if (isFeatureEnabled(config.textColor)) {
    extensions.push(Color);
  }
  if (isFeatureEnabled(config.highlightColor)) {
    extensions.push(Highlight.configure({ multicolor: true }));
  }
  if (isFeatureEnabled(config.fontFamily)) {
    extensions.push(FontFamily);
  }
  if (isFeatureEnabled(config.fontSize)) {
    extensions.push(FontSize);
  }
  if (isFeatureEnabled(config.lineHeight)) {
    extensions.push(LineHeight);
  }
  if (isFeatureEnabled(config.mediaLibrary)) {
    const mediaOpts = getFeatureOptions(config.mediaLibrary, {});
    extensions.push(StrapiImage.configure(mediaOpts ?? {}));
  } else {
    extensions.push(StrapiImage.configure({ enableContentCheck: true }));
  }

  // Schema-only: always registered so stored semantic marks round-trip without data loss
  extensions.push(LeadParagraph, LanguageMark, AbbrMark);

  if (isFeatureEnabled(config.typography)) {
    extensions.push(SmartTypographyExtension);
  }

  extensions.push(Gapcursor);

  return extensions;
}
