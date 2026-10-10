import { forwardRef, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Box } from '@strapi/design-system';
import BaseTiptapInput from './BaseTiptapInput';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { FeatureGuard } from './FeatureGuard';
import { TiptapInputProps, useTiptapEditor } from '../utils/tiptapUtils';
import { Spacer } from './Spacer';
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
import { useSpeechTools } from '../extensions/SpeechTools';
import { useEditorModes } from './EditorFooterAndModes';
import { usePresetConfig } from '../hooks/usePresetConfig';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useRelationalSync } from '../hooks/useRelationalSync';
import { buildExtensions } from '../utils/buildExtensions';
import {
  TiptapPresetConfig,
  MINIMAL_PRESET_CONFIG,
  getFeatureOptions,
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

const InnerEditor = forwardRef<HTMLDivElement, InnerEditorProps>(
  ({ config, presetName, outputFormat, characterLimit, placeholder: _placeholder, ...props }, forwardedRef) => {
    // Memoize on presetName string — stable across parent re-renders
    const extensions = useMemo(() => {
      return buildExtensions(config);
    }, [presetName]); // eslint-disable-line react-hooks/exhaustive-deps

    const { syncRelationsFromDoc } = useRelationalSync(props.name);

    const { editor, field } = useTiptapEditor(props.name, '', extensions, {
      outputFormat: outputFormat ?? 'json',
      onDocUpdate: syncRelationsFromDoc,
    });

    const { toolbarRef, handleToolbarKeyDown } = useKeyboardNavigation(editor);

    const starterKit = useStarterKit(editor, { disabled: props.disabled });
    const headingOptions = getFeatureOptions(config.heading, { levels: [1, 2, 3, 4, 5, 6] });
    const heading = useHeading(editor, { disabled: props.disabled, levels: headingOptions?.levels });
    const link = useLink(editor, { disabled: props.disabled });
    const image = useImage(editor, { disabled: props.disabled });
    const video = useVideo(editor, { disabled: props.disabled });
    const audio = useAudio(editor, { disabled: props.disabled });
    const attachment = useAttachment(editor, { disabled: props.disabled });
    const iframe = useIframe(editor, { disabled: props.disabled });
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
    const speech = useSpeechTools(editor, { disabled: props.disabled });

    const charCountOpts = getFeatureOptions(config.characterCount, { limit: characterLimit });
    const editorModes = useEditorModes(editor, {
      disabled: props.disabled,
      characterLimit: charCountOpts?.limit ?? characterLimit,
      showCharacterCount: Boolean(config?.characterCount || (characterLimit && characterLimit > 0)),
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
          <FeatureGuard featureValue={config?.heading}>
            {heading.headingSelect}
            {heading.headingTagSelect}
            <Spacer width={8} />
          </FeatureGuard>
          <FeatureGuard featureValue={config?.fontFamily}>
            {typography.fontFamilySelect}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.fontSize}>
            {typography.fontSizeSelect}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.lineHeight}>
            {typography.lineHeightSelect}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.clearFormatting}>
            {typography.clearFormattingButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.leadParagraph}>
            {semanticMarks.leadParagraphButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.bold}>
            {starterKit.boldButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.italic}>
            {starterKit.italicButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.underline}>
            {starterKit.underlineButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.strike}>
            {starterKit.strikeButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.superscript}>
            {script.superscriptButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.subscript}>
            {script.subscriptButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.textColor}>
            {textColor.textColorButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.highlightColor}>
            {highlightColor.highlightColorButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.abbr}>
            {semanticMarks.abbrButton}
            {semanticMarks.abbrDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.language}>
            {semanticMarks.languageButton}
            {semanticMarks.languageDialog}
          </FeatureGuard>
          <Spacer width={8} />
          <FeatureGuard featureValue={config?.textAlign}>
            {textAlign.textAlignLeftButton}
            {textAlign.textAlignCenterButton}
            {textAlign.textAlignRightButton}
            {textAlign.textAlignJustifyButton}
            <Spacer width={8} />
          </FeatureGuard>
          <FeatureGuard featureValue={config?.bulletList}>
            {starterKit.bulletButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.orderedList}>
            {starterKit.orderedButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.taskList}>
            {structuredBlocks.taskListButton}
          </FeatureGuard>
          <Spacer width={8} />
          <FeatureGuard featureValue={config?.code}>
            {starterKit.codeButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.blockquote}>
            {starterKit.blockquoteButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.informationPane}>
            {informationPane.informationPaneButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.conversationHistory}>
            {structuredBlocks.conversationHistoryButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.accordion}>
            {structuredBlocks.accordionButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.columns}>
            {structuredBlocks.columnsButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.mathematics}>
            {mathematics.mathematicsButton}
            {mathematics.mathematicsDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.emoji}>
            {emoji.emojiButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.pageBreak}>
            {structuredBlocks.pageBreakButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.tableOfContents}>
            {structuredBlocks.tableOfContentsButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.link}>
            {link.linkButton}
            {link.linkDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.linker}>
            {linker.linkerButton}
            {linker.linkerDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.mediaLibrary}>
            {image.imageButton}
            {image.imageDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.video}>
            {video.videoButton}
            {video.videoDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.audio}>
            {audio.audioButton}
            {audio.audioDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.attachment}>
            {attachment.attachmentButton}
            {attachment.attachmentDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.iframe}>
            {iframe.iframeButton}
            {iframe.iframeDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.table}>
            <Spacer width={8} />
            {table.tableButton}
            {table.addColumnButton}
            {table.removeColumnButton}
            {table.addRowButton}
            {table.removeRowButton}
            {table.cellColorButton}
            {table.mergeCellsButton}
            {table.splitCellButton}
            {table.tableDialog}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.speechToText}>
            <Spacer width={8} />
            {speech.speechToTextButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.textToSpeech}>
            {speech.textToSpeechButton}
          </FeatureGuard>
          <FeatureGuard featureValue={config?.fullscreen}>
            <Spacer width={8} />
            {editorModes.previewButton}
            {editorModes.sourceButton}
            {editorModes.fullscreenButton}
          </FeatureGuard>
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

const RichTextInput = forwardRef<HTMLDivElement, RichTextInputProps>((props, forwardedRef) => {
  const { formatMessage } = useIntl();
  const rawPresetName = props.attribute?.options?.preset;
  const normalizedPresetName = rawPresetName?.trim() || undefined;
  const outputFormat = props.attribute?.options?.outputFormat;
  const characterLimit = props.attribute?.options?.characterLimit;
  const placeholder = props.attribute?.options?.placeholder;

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
      ref={forwardedRef}
      config={config ?? MINIMAL_PRESET_CONFIG}
      presetName={normalizedPresetName}
      outputFormat={outputFormat}
      characterLimit={characterLimit}
      placeholder={placeholder}
      {...props}
    />
  );
});

export default RichTextInput;
