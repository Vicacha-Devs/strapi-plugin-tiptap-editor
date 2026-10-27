import { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Underline from '@tiptap/extension-underline';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { CharacterCount, Gapcursor } from '@tiptap/extensions';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { BaseHeadingWithSEOTag } from '../extensions/Heading';
import { PasteStripper } from '../extensions/PasteStripper';
import { StrapiImage } from '../extensions/Image';
import { InformationPane } from '../extensions/InformationPane';
import {
  DetailsNode,
  DetailsSummaryNode,
  DetailsContentNode,
  ConversationHistoryNode,
  LayoutContainerNode,
  LayoutColumnNode,
  TaskListNode,
  TaskItemNode,
  PageBreakNode,
  TableOfContentsNode,
} from '../extensions/StructuredBlocks';
import { MathematicsNode } from '../extensions/Mathematics';
import { EmojiShortcodeExtension } from '../extensions/EmojiPicker';
import { TiptapPresetConfig, isFeatureEnabled, getFeatureOptions } from '../../../shared/types';

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

export interface BuildExtensionsOptions {
  characterLimit?: number;
}

/**
 * Builds the array of TipTap extensions for a given preset configuration and field options.
 * Structured block schemas are always registered so stored content round-trips without data loss.
 */
export function buildExtensions(
  config: TiptapPresetConfig,
  options?: BuildExtensionsOptions
): Extensions {
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
    });
    const levels = headingConfig?.levels || [1, 2, 3, 4, 5, 6];
    extensions.push(BaseHeadingWithSEOTag.configure({ levels }));
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
      })
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
    isFeatureEnabled(config.textColor) || isFeatureEnabled(config.highlightColor);
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
  if (isFeatureEnabled(config.mediaLibrary)) {
    const mediaOpts = getFeatureOptions(config.mediaLibrary, {});
    extensions.push(StrapiImage.configure(mediaOpts ?? {}));
  } else {
    extensions.push(StrapiImage.configure({ enableContentCheck: true }));
  }

  extensions.push(
    isFeatureEnabled(config.informationPane)
      ? InformationPane.configure({ enableContentCheck: false })
      : InformationPane.configure({ enableContentCheck: true }),
    isFeatureEnabled(config.mathematics)
      ? MathematicsNode.configure({ enableContentCheck: false })
      : MathematicsNode.configure({ enableContentCheck: true })
  );

  // Schema-only: always registered so stored content round-trips without data loss
  extensions.push(
    DetailsNode,
    DetailsSummaryNode,
    DetailsContentNode,
    ConversationHistoryNode,
    LayoutContainerNode,
    LayoutColumnNode,
    TaskListNode,
    TaskItemNode,
    PageBreakNode,
    TableOfContentsNode
  );

  // Input-rule extension: gated by preset config
  if (isFeatureEnabled(config.emoji)) {
    extensions.push(EmojiShortcodeExtension);
  }

  const ccEnabled =
    config.characterCount === undefined || isFeatureEnabled(config.characterCount);
  const ccOpts = ccEnabled ? getFeatureOptions(config.characterCount, { limit: null }) : null;
  const effectiveCharLimit =
    options?.characterLimit && options.characterLimit > 0
      ? options.characterLimit
      : ccOpts?.limit ?? null;

  if (ccEnabled || (effectiveCharLimit && effectiveCharLimit > 0)) {
    extensions.push(CharacterCount.configure({ limit: effectiveCharLimit }));
  }

  extensions.push(Gapcursor);

  return extensions;
}
