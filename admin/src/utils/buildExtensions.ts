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
import {
  getRegisteredTiptapExtensions,
  isCustomExtensionEnabledForPreset,
} from './customExtensionRegistry';
import { StrapiImage } from '../extensions/Image';
import { StrapiVideo } from '../extensions/Video';
import { StrapiAudio } from '../extensions/Audio';
import { StrapiAttachment } from '../extensions/Attachment';
import { StrapiIframe } from '../extensions/Iframe';
import { StrapiLinker } from '../extensions/Linker';
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
      : (() => {
          const { allowInternalLinks, ...rest } =
            (getFeatureOptions(config.link, { allowInternalLinks: true }) as {
              allowInternalLinks?: boolean;
              [key: string]: unknown;
            }) ?? {};
          return {
            openOnClick: false,
            ...rest,
            ...(allowInternalLinks
              ? { protocols: [{ scheme: 'strapi', optionalSlashes: false }] }
              : {}),
          };
        })(),
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

  // Zero-Data-Loss multimedia & embed nodes: always registered so stored content round-trips
  // without data loss; content checks are only relaxed when the feature is enabled in the preset.
  extensions.push(
    StrapiVideo.configure({ enableContentCheck: !isFeatureEnabled(config.video) }),
    StrapiAudio.configure({ enableContentCheck: !isFeatureEnabled(config.audio) }),
    StrapiAttachment.configure({ enableContentCheck: !isFeatureEnabled(config.attachment) })
  );

  if (isFeatureEnabled(config.iframe)) {
    const iframeOpts = getFeatureOptions(config.iframe, { allowedDomains: [] });
    extensions.push(
      StrapiIframe.configure({
        enableContentCheck: false,
        allowedDomains: iframeOpts?.allowedDomains,
      })
    );
  } else {
    extensions.push(StrapiIframe.configure({ enableContentCheck: true }));
  }

  extensions.push(StrapiLinker.configure({ enableContentCheck: !isFeatureEnabled(config.linker) }));

  // Schema-only: always registered so stored semantic marks round-trip without data loss
  extensions.push(LeadParagraph, LanguageMark, AbbrMark);

  if (isFeatureEnabled(config.typography)) {
    extensions.push(SmartTypographyExtension);
  }

  extensions.push(Gapcursor);

  // Registered custom extensions (e.g. scriptureEmbed, beforeAfterImage)
  for (const registration of getRegisteredTiptapExtensions()) {
    if (!isCustomExtensionEnabledForPreset(registration, config)) continue;
    const resolved =
      typeof registration.extensions === 'function'
        ? registration.extensions({ config, enableContentCheck: true })
        : registration.extensions;
    if (Array.isArray(resolved)) {
      extensions.push(...resolved);
    } else if (resolved) {
      extensions.push(resolved);
    }
  }

  return extensions;
}
