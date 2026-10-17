import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { unstable_useContentManagerContext } from '@strapi/strapi/admin';
import { Box } from '@strapi/design-system';
import BaseTiptapInput from './BaseTiptapInput';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { Spacer } from './Spacer';
import { TiptapInputProps, useTiptapEditor } from '../utils/tiptapUtils';
import { ResponsiveToolbar, type ToolbarItem } from './ResponsiveToolbar';
import { useStarterKit } from '../extensions/StarterKit';
import { useLink } from '../extensions/Link';
import { useHeading } from '../extensions/Heading';
import { useImage } from '../extensions/Image';
import { useVideo } from '../extensions/Video';
import { useAudio } from '../extensions/Audio';
import { useAttachment } from '../extensions/Attachment';
import { useIframe } from '../extensions/Iframe';
import { useLinker } from '../extensions/Linker';
import { useScript } from '../extensions/Script';
import { useTable } from '../extensions/Table';
import { useTextAlign } from '../extensions/TextAlign';
import { useTextColor } from '../extensions/TextColor';
import { useHighlightColor } from '../extensions/HighlightColor';
import { useTypographyControls } from '../extensions/TypographyControls';
import { useSemanticMarks } from '../extensions/SemanticMarks';
import { useInformationPane } from '../extensions/InformationPane';
import { useStructuredBlocks } from '../extensions/StructuredBlocks';
import { useMathematics } from '../extensions/Mathematics';
import { useEmojiPicker } from '../extensions/EmojiPicker';
import { useSlashCommand } from '../extensions/SlashCommand';
import { useSpeechTools } from '../extensions/SpeechTools';
import { useEditorModes } from './EditorFooterAndModes';
import { usePresetConfig } from '../hooks/usePresetConfig';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useRelationalSync } from '../hooks/useRelationalSync';
import { buildExtensions } from '../utils/buildExtensions';
import {
  TiptapPresetConfig,
  MINIMAL_PRESET_CONFIG,
  DEFAULT_RUNTIME_SETTINGS,
  getFeatureOptions,
  isFeatureEnabled,
  type TiptapOutputFormat,
} from '../../../shared/types';

// ─── Inner editor ────────────────────────────────────────────────────────────
// Mounted only AFTER preset config is resolved, so useEditor receives the
// correct extensions on first render and never needs to swap them.

type InnerEditorProps = TiptapInputProps & {
  config: TiptapPresetConfig;
  presetName: string | undefined;
  outputFormat?: TiptapOutputFormat;
  characterLimit?: number;
  placeholder?: string;
};

/**
 * Type guard to check if a toolbar item is valid.
 * @param item - The toolbar item to check.
 * @returns True if the item is a valid ToolbarItem, false otherwise.
 */
const isToolbarItem = (item: ToolbarItem | false | undefined): item is ToolbarItem => Boolean(item);

/**
 * Inner TipTap editor component rendered once the preset configuration is loaded.
 */
const InnerEditor = forwardRef<HTMLDivElement, InnerEditorProps>(
  ({ config, presetName, outputFormat, characterLimit, placeholder, ...props }, forwardedRef) => {
    const { contentType, components } = unstable_useContentManagerContext() as {
      contentType?: { attributes?: Record<string, Record<string, unknown>> };
      components?: Record<string, { attributes?: Record<string, Record<string, unknown>> }>;
    };
    const schemaAttributes = contentType?.attributes;
    const linksFieldSchema = schemaAttributes?.[`${props.name}Links`];
    const linksFieldIsRepeatable = Boolean(linksFieldSchema?.repeatable);

    const { availableFields, targetUidToAttribute } = useMemo(() => {
      const fields = schemaAttributes ? Object.keys(schemaAttributes) : undefined;
      const componentUid =
        (typeof linksFieldSchema?.component === 'string' && linksFieldSchema.component) ||
        'links.links';
      const compAttrs = components?.[componentUid]?.attributes;
      const uidMap: Record<string, string> = {};
      if (compAttrs) {
        for (const [attrName, attrDef] of Object.entries(compAttrs)) {
          const targetUid = attrDef?.target ?? attrDef?.targetModel;
          if (attrDef?.type === 'relation' && typeof targetUid === 'string') {
            uidMap[targetUid] = attrName;
          }
        }
      }
      return { availableFields: fields, targetUidToAttribute: uidMap };
    }, [schemaAttributes, components, linksFieldSchema?.component]);

    // Memoize on [config, characterLimit, placeholder] with a fixed-length dependency array
    const extensions = useMemo(() => {
      if (characterLimit !== undefined || placeholder !== undefined) {
        return buildExtensions(config, { characterLimit, placeholder });
      }
      return buildExtensions(config);
    }, [config, characterLimit, placeholder]); // eslint-disable-line react-hooks/exhaustive-deps

    const [relationalSyncEnabled, setRelationalSyncEnabled] = useState<boolean>(
      DEFAULT_RUNTIME_SETTINGS.enableRelationalSync
    );

    useEffect(() => {
      let mounted = true;
      import('@strapi/strapi/admin')
        .then(({ getFetchClient }) => {
          if (typeof getFetchClient !== 'function') return undefined;
          return getFetchClient().get('/tiptap-editor/settings');
        })
        .then((res: { data?: { enableRelationalSync?: boolean } } | undefined) => {
          if (mounted && typeof res?.data?.enableRelationalSync === 'boolean') {
            setRelationalSyncEnabled(res.data.enableRelationalSync);
          }
        })
        .catch(() => {
          // Keep default in isolated/offline environments
        });
      return () => {
        mounted = false;
      };
    }, []);

    const onFormChangeRef = useRef<((fieldName: string, value: unknown) => void) | undefined>(
      undefined
    );

    const { syncRelationsFromDoc } = useRelationalSync(props.name, {
      enabled: relationalSyncEnabled,
      availableFields,
      targetUidToAttribute,
      linksFieldIsRepeatable,
      initialDocument: (props as { value?: unknown }).value,
      onSyncField: (fieldName, value) => onFormChangeRef.current?.(fieldName, value),
    });

    const { editor, field } = useTiptapEditor(props.name, '', extensions, {
      outputFormat: outputFormat ?? 'json',
      onDocUpdate: syncRelationsFromDoc,
    });

    useEffect(() => {
      onFormChangeRef.current = field?.onChange as
        | ((fieldName: string, value: unknown) => void)
        | undefined;
    }, [field?.onChange]);

    const { toolbarRef, handleToolbarKeyDown } = useKeyboardNavigation(editor);

    const starterKit = useStarterKit(editor, { disabled: props.disabled });
    const headingOptions = getFeatureOptions(config.heading, { levels: [1, 2, 3, 4, 5, 6] });
    const heading = useHeading(editor, { disabled: props.disabled, levels: headingOptions?.levels });
    const link = useLink(editor, { disabled: props.disabled });
    const image = useImage(editor, { disabled: props.disabled });
    const video = useVideo(editor, { disabled: props.disabled });
    const audio = useAudio(editor, { disabled: props.disabled });
    const attachment = useAttachment(editor, { disabled: props.disabled });
    const iframeOpts = getFeatureOptions(config.iframe, { allowedDomains: [] as string[] });
    const iframe = useIframe(editor, {
      disabled: props.disabled,
      allowedDomains: iframeOpts?.allowedDomains,
    });
    const linker = useLinker(editor, { disabled: props.disabled });
    const script = useScript(editor, { disabled: props.disabled });
    const table = useTable(editor, { disabled: props.disabled });
    const textAlign = useTextAlign(editor, { disabled: props.disabled });
    const textColor = useTextColor(editor, { disabled: props.disabled });
    const highlightColor = useHighlightColor(editor, { disabled: props.disabled });
    const typography = useTypographyControls(editor, { disabled: props.disabled });
    const semanticMarks = useSemanticMarks(editor, { disabled: props.disabled });
    const informationPane = useInformationPane(editor, { disabled: props.disabled });
    const structuredBlocks = useStructuredBlocks(editor, { disabled: props.disabled });
    const mathematics = useMathematics(editor, { disabled: props.disabled });
    const emoji = useEmojiPicker(editor, { disabled: props.disabled });
    const slashCommand = useSlashCommand(editor, { disabled: props.disabled });
    const speech = useSpeechTools(editor, { disabled: props.disabled });

    const charCountOpts = getFeatureOptions(config.characterCount, {
      limit: characterLimit,
      wordsPerMinute: 200,
    });
    const editorModes = useEditorModes(editor, {
      disabled: props.disabled,
      characterLimit: charCountOpts?.limit ?? characterLimit,
      wordsPerMinute: charCountOpts?.wordsPerMinute,
      showCharacterCount:
        config?.characterCount !== false || Boolean(characterLimit && characterLimit > 0),
    });

    const toolbarItemCandidates: Array<ToolbarItem | false | undefined> = [
      Boolean(config?.heading) && {
        id: 'heading',
        content: (
          <>
            {heading.headingSelect}
            {heading.headingTagSelect}
          </>
        ),
      },
      Boolean(config?.fontFamily) && { id: 'fontFamily', content: typography.fontFamilySelect },
      Boolean(config?.fontSize) && { id: 'fontSize', content: typography.fontSizeSelect },
      Boolean(config?.lineHeight) && { id: 'lineHeight', content: typography.lineHeightSelect },
      Boolean(config?.clearFormatting) && {
        id: 'clearFormatting',
        content: typography.clearFormattingButton,
      },
      Boolean(config?.leadParagraph) && {
        id: 'leadParagraph',
        content: semanticMarks.leadParagraphButton,
      },
      Boolean(
        config?.heading ||
          config?.fontFamily ||
          config?.fontSize ||
          config?.lineHeight ||
          config?.clearFormatting ||
          config?.leadParagraph
      ) && {
        id: 'headingSpacer',
        content: <Spacer margin={1} />,
      },
      Boolean(config?.bold) && { id: 'bold', content: starterKit.boldButton },
      Boolean(config?.italic) && { id: 'italic', content: starterKit.italicButton },
      Boolean(config?.underline) && { id: 'underline', content: starterKit.underlineButton },
      Boolean(config?.bold || config?.italic || config?.underline) && {
        id: 'basicTextSpacer',
        content: <Spacer margin={1} />,
      },
      Boolean(config?.strike) && { id: 'strike', content: starterKit.strikeButton },
      Boolean(config?.superscript) && { id: 'superscript', content: script.superscriptButton },
      Boolean(config?.subscript) && { id: 'subscript', content: script.subscriptButton },
      Boolean(config?.textColor) && { id: 'textColor', content: textColor.textColorButton },
      Boolean(config?.highlightColor) && {
        id: 'highlightColor',
        content: highlightColor.highlightColorButton,
      },
      Boolean(config?.abbr) && {
        id: 'abbr',
        content: semanticMarks.abbrButton,
        overlay: semanticMarks.abbrDialog,
      },
      Boolean(config?.language) && {
        id: 'language',
        content: semanticMarks.languageButton,
        overlay: semanticMarks.languageDialog,
      },
      Boolean(
        config?.strike ||
          config?.superscript ||
          config?.subscript ||
          config?.textColor ||
          config?.highlightColor ||
          config?.abbr ||
          config?.language
      ) && {
        id: 'textDecorationSpacer',
        content: <Spacer margin={1} />,
      },
      Boolean(config?.textAlign) && {
        id: 'textAlign',
        content: (
          <>
            {textAlign.textAlignLeftButton}
            {textAlign.textAlignCenterButton}
            {textAlign.textAlignRightButton}
            {textAlign.textAlignJustifyButton}
          </>
        ),
      },
      Boolean(config?.textAlign) && { id: 'textAlignSpacer', content: <Spacer margin={1} /> },
      Boolean(config?.bulletList) && { id: 'bullet', content: starterKit.bulletButton },
      Boolean(config?.orderedList) && { id: 'ordered', content: starterKit.orderedButton },
      Boolean(config?.taskList) && { id: 'taskList', content: structuredBlocks.taskListButton },
      Boolean(config?.bulletList || config?.orderedList || config?.taskList) && {
        id: 'listSpacer',
        content: <Spacer margin={1} />,
      },
      Boolean(config?.code) && { id: 'code', content: starterKit.codeButton },
      Boolean(config?.blockquote) && { id: 'blockquote', content: starterKit.blockquoteButton },
      Boolean(config?.informationPane) && {
        id: 'informationPane',
        content: informationPane.informationPaneButton,
      },
      Boolean(config?.conversationHistory) && {
        id: 'conversationHistory',
        content: structuredBlocks.conversationHistoryButton,
      },
      Boolean(config?.accordion) && {
        id: 'accordion',
        content: structuredBlocks.accordionButton,
      },
      Boolean(config?.columns) && { id: 'columns', content: structuredBlocks.columnsButton },
      Boolean(config?.mathematics) && {
        id: 'mathematics',
        content: mathematics.mathematicsButton,
        overlay: mathematics.mathematicsDialog,
      },
      Boolean(config?.emoji) && {
        id: 'emoji',
        content: emoji.emojiButton,
        measureContent: emoji.emojiTrigger,
      },
      isFeatureEnabled(config?.slashCommands) && {
        id: 'slashCommands',
        content: slashCommand.slashCommandButton,
        measureContent: slashCommand.slashCommandTrigger,
      },
      Boolean(config?.pageBreak) && {
        id: 'pageBreak',
        content: structuredBlocks.pageBreakButton,
      },
      Boolean(config?.tableOfContents) && {
        id: 'tableOfContents',
        content: structuredBlocks.tableOfContentsButton,
      },
      Boolean(config?.link) && {
        id: 'link',
        content: link.linkButton,
        overlay: link.linkDialog,
      },
      Boolean(config?.linker) && {
        id: 'linker',
        content: linker.linkerButton,
        overlay: linker.linkerDialog,
      },
      Boolean(config?.mediaLibrary) && {
        id: 'mediaLibrary',
        content: image.imageButton,
        overlay: image.imageDialog,
      },
      Boolean(config?.video) && {
        id: 'video',
        content: video.videoButton,
        overlay: video.videoDialog,
      },
      Boolean(config?.audio) && {
        id: 'audio',
        content: audio.audioButton,
        overlay: audio.audioDialog,
      },
      Boolean(config?.attachment) && {
        id: 'attachment',
        content: attachment.attachmentButton,
        overlay: attachment.attachmentDialog,
      },
      Boolean(config?.iframe) && {
        id: 'iframe',
        content: iframe.iframeButton,
        overlay: iframe.iframeDialog,
      },
      Boolean(
        config?.code ||
          config?.blockquote ||
          config?.informationPane ||
          config?.conversationHistory ||
          config?.accordion ||
          config?.columns ||
          config?.mathematics ||
          config?.emoji ||
          isFeatureEnabled(config?.slashCommands) ||
          config?.pageBreak ||
          config?.tableOfContents ||
          config?.link ||
          config?.linker ||
          config?.mediaLibrary ||
          config?.video ||
          config?.audio ||
          config?.attachment ||
          config?.iframe
      ) && {
        id: 'insertSpacer',
        content: <Spacer margin={1} />,
      },
      Boolean(config?.table) && {
        id: 'table',
        content: (
          <>
            {table.tableButton}
            {table.addColumnButton}
            {table.removeColumnButton}
            {table.addRowButton}
            {table.removeRowButton}
            {table.cellColorButton}
            {table.mergeCellsButton}
            {table.splitCellButton}
          </>
        ),
        overlay: table.tableDialog,
      },
      Boolean(config?.table) && { id: 'tableSpacer', content: <Spacer margin={1} /> },
      Boolean(config?.speechToText) && {
        id: 'speechToText',
        content: speech.speechToTextButton,
      },
      Boolean(config?.textToSpeech) && {
        id: 'textToSpeech',
        content: speech.textToSpeechButton,
      },
      Boolean(config?.speechToText || config?.textToSpeech) && {
        id: 'speechSpacer',
        content: <Spacer margin={1} />,
      },
      Boolean(config?.fullscreen) && {
        id: 'fullscreen',
        content: (
          <>
            {editorModes.previewButton}
            {editorModes.sourceButton}
            {editorModes.fullscreenButton}
          </>
        ),
      },
    ];

    const rawToolbarItems = toolbarItemCandidates.filter(isToolbarItem);

    // Clean up consecutive, leading, or trailing spacers
    const toolbarItems = rawToolbarItems.filter((item, idx, arr) => {
      const isSpacer = item.id.toLowerCase().includes('spacer');
      if (!isSpacer) return true;

      if (idx === 0 || idx === arr.length - 1) return false;

      const prevIsSpacer = arr[idx - 1].id.toLowerCase().includes('spacer');
      return !prevIsSpacer;
    });

    if (!editor) return null;

    return (
      <EditorErrorBoundary>
        <BaseTiptapInput
          editor={editor}
          field={field}
          {...props}
          ref={forwardedRef}
          noPresetConfigured={!presetName}
          isFullscreen={editorModes.isFullscreen}
          toolbarRef={toolbarRef}
          onToolbarKeyDown={handleToolbarKeyDown}
          footer={
            <>
              {editorModes.inspectorDrawer}
              {editorModes.characterCountFooter}
              {speech.speechLiveRegion}
            </>
          }
        >
          <ResponsiveToolbar items={toolbarItems} />
        </BaseTiptapInput>
      </EditorErrorBoundary>
    );
  }
);

// ─── Outer wrapper ───────────────────────────────────────────────────────────
// Handles async preset fetching; renders loading state until config is ready.

type RichTextInputProps = TiptapInputProps & {
  attribute?: {
    options?: {
      preset?: string;
      outputFormat?: TiptapOutputFormat;
      characterLimit?: number;
      placeholder?: string;
    };
  };
};

/**
 * Top-level Strapi custom field wrapper that resolves the field's preset configuration
 * before mounting the inner TipTap editor.
 */
const RichTextInput = forwardRef<HTMLDivElement, RichTextInputProps>((props, forwardedRef) => {
  const { formatMessage } = useIntl();
  const rawPresetName = props.attribute?.options?.preset;
  const normalizedPresetName = rawPresetName?.trim() || undefined;
  const outputFormat = props.attribute?.options?.outputFormat;
  const characterLimit = props.attribute?.options?.characterLimit;
  const placeholder =
    props.attribute?.options?.placeholder ??
    (typeof (props as { placeholder?: unknown }).placeholder === 'string'
      ? (props as { placeholder?: string }).placeholder
      : undefined);

  const { config, isLoading } = usePresetConfig(normalizedPresetName);

  if (isLoading) {
    return (
      <Box padding={4}>
        {formatMessage({ id: 'tiptap-editor.loading', defaultMessage: 'Loading editor...' })}
      </Box>
    );
  }

  return (
    <InnerEditor
      {...props}
      ref={forwardedRef}
      config={config ?? MINIMAL_PRESET_CONFIG}
      presetName={normalizedPresetName}
      outputFormat={outputFormat}
      characterLimit={characterLimit}
      placeholder={placeholder}
    />
  );
});

export default RichTextInput;
