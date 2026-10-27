import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { getFetchClient, unstable_useContentManagerContext, useField } from '@strapi/strapi/admin';
import { useIntl } from 'react-intl';
import { Box } from '@strapi/design-system';
import BaseTiptapInput from './BaseTiptapInput';
import { EditorErrorBoundary } from './EditorErrorBoundary';
import { Spacer } from './Spacer';
import { TiptapInputProps, useTiptapEditor } from '../utils/tiptapUtils';
import { ResponsiveToolbar } from './ResponsiveToolbar';
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
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { usePresetConfig } from '../hooks/usePresetConfig';
import { useRelationalSync } from '../hooks/useRelationalSync';
import { buildExtensions } from '../utils/buildExtensions';
import {
  getRegisteredTiptapExtensions,
  isCustomExtensionEnabledForPreset,
} from '../utils/customExtensionRegistry';
import { ToolbarButton } from './ToolbarButton';
import {
  TiptapPresetConfig,
  MINIMAL_PRESET_CONFIG,
  DEFAULT_RUNTIME_SETTINGS,
  getFeatureOptions,
  type FontFamilyConfig,
  type FontSizeConfig,
  type LineHeightConfig,
  type TiptapRuntimeSettings,
} from '../../../shared/types';
import type { ToolbarItem } from './ResponsiveToolbar';

// ─── Inner editor ────────────────────────────────────────────────────────────
// Mounted only AFTER preset config is resolved, so useEditor receives the
// correct extensions on first render and never needs to swap them.

type InnerEditorProps = TiptapInputProps & {
  config: TiptapPresetConfig;
  presetName: string | undefined;
  relationalSyncEnabled?: boolean;
};

/**
 * Type guard to check if a toolbar item is valid.
 * @param item - The toolbar item to check.
 * @returns True if the item is a valid ToolbarItem, false otherwise.
 */
const isToolbarItem = (item: ToolbarItem | false | undefined): item is ToolbarItem => Boolean(item);

const InnerEditor = forwardRef<HTMLDivElement, InnerEditorProps>(
  ({ config, presetName, relationalSyncEnabled, ...props }, forwardedRef) => {
    const { contentType, components } = unstable_useContentManagerContext() as {
      contentType?: { attributes?: Record<string, Record<string, unknown>> };
      components?: Record<string, { attributes?: Record<string, Record<string, unknown>> }>;
    };
    const schemaAttributes = contentType?.attributes;
    const linksFieldName = `${props.name}Links`;
    const linksFieldSchema = schemaAttributes?.[linksFieldName];
    const linksFieldIsRepeatable = Boolean(linksFieldSchema?.repeatable);
    const linksField = useField<
      Record<string, unknown> | Array<Record<string, unknown>> | null
    >(linksFieldName);

    const { availableFields, targetUidToAttribute, linksComponentUid } = useMemo(() => {
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
      return {
        availableFields: fields,
        targetUidToAttribute: uidMap,
        linksComponentUid: componentUid,
      };
    }, [schemaAttributes, components, linksFieldSchema?.component]);

    const onFormChangeRef = useRef<((fieldName: string, value: unknown) => void) | undefined>(
      undefined
    );

    const { syncRelationsFromDoc, seedSignature } = useRelationalSync(props.name, {
      enabled: relationalSyncEnabled ?? DEFAULT_RUNTIME_SETTINGS.enableRelationalSync,
      availableFields,
      targetUidToAttribute,
      linksComponentUid,
      linksFieldIsRepeatable,
      initialDocument: (props as { value?: unknown }).value,
      onSyncField: (fieldName, value) => {
        const currentLinksValue = linksField?.value;
        let nextValue = value;
        if (fieldName === linksFieldName && value !== null && typeof value === 'object') {
          if (linksFieldIsRepeatable && Array.isArray(value)) {
            const currentArr = Array.isArray(currentLinksValue) ? currentLinksValue : [];
            const firstExisting =
              currentArr[0] && typeof currentArr[0] === 'object' && !Array.isArray(currentArr[0])
                ? currentArr[0]
                : {};
            const firstIncoming =
              value[0] && typeof value[0] === 'object' && !Array.isArray(value[0])
                ? (value[0] as Record<string, unknown>)
                : {};
            nextValue = [{ ...firstExisting, ...firstIncoming }, ...currentArr.slice(1)];
          } else if (!linksFieldIsRepeatable && !Array.isArray(value)) {
            nextValue = {
              ...(currentLinksValue &&
              typeof currentLinksValue === 'object' &&
              !Array.isArray(currentLinksValue)
                ? currentLinksValue
                : {}),
              ...value,
            };
          }
        }

        onFormChangeRef.current?.(fieldName, nextValue);
      },
    });

    // Memoize on presetName string — stable across parent re-renders
    const extensions = useMemo(() => {
      return buildExtensions(config);
    }, [presetName]); // eslint-disable-line react-hooks/exhaustive-deps

    const { editor, field } = useTiptapEditor(props.name, '', extensions, {
      onDocUpdate: syncRelationsFromDoc,
    });

    useEffect(() => {
      if (editor && typeof (editor as { getJSON?: () => unknown }).getJSON === 'function') {
        seedSignature?.((editor as { getJSON: () => unknown }).getJSON());
      }
    }, [editor, seedSignature, field?.initialValue]);

    useEffect(() => {
      onFormChangeRef.current = field?.onChange as
        | ((fieldName: string, value: unknown) => void)
        | undefined;
    }, [field?.onChange]);

    const starterKit = useStarterKit(editor, { disabled: props.disabled });
    const headingOptions = getFeatureOptions(config.heading, { levels: [1, 2, 3, 4, 5, 6] });
    const heading = useHeading(editor, { disabled: props.disabled, levels: headingOptions?.levels });
    const link = useLink(editor, { disabled: props.disabled });
    const image = useImage(editor, { disabled: props.disabled });
    const video = useVideo(editor, { disabled: props.disabled });
    const audio = useAudio(editor, { disabled: props.disabled });
    const attachment = useAttachment(editor, { disabled: props.disabled });
    const iframeOptions = getFeatureOptions(config.iframe, { allowedDomains: [] as string[] });
    const iframe = useIframe(editor, {
      disabled: props.disabled,
      allowedDomains: iframeOptions?.allowedDomains,
    });
    const linker = useLinker(editor, { disabled: props.disabled });
    const script = useScript(editor, { disabled: props.disabled });
    const table = useTable(editor, { disabled: props.disabled });
    const textAlign = useTextAlign(editor, { disabled: props.disabled });
    const textColor = useTextColor(editor, { disabled: props.disabled, config: config.textColor });
    const highlightColor = useHighlightColor(editor, { disabled: props.disabled, config: config.highlightColor });
    const { toolbarRef, handleToolbarKeyDown } = useKeyboardNavigation(editor);

    const [openCustomDialogId, setOpenCustomDialogId] = useState<string | null>(null);

    const customExtensionToolbarItems: ToolbarItem[] = getRegisteredTiptapExtensions()
      .filter(
        (ext) =>
          isCustomExtensionEnabledForPreset(ext, config) &&
          Boolean(ext.ToolbarComponent || ext.toolbarButton || ext.DialogComponent)
      )
      .map((ext) => {
        const isDialogOpen = openCustomDialogId === ext.id;
        const handleOpenDialog = () => setOpenCustomDialogId(ext.id);
        const handleCloseDialog = () => setOpenCustomDialogId(null);

        let content: React.ReactNode = null;
        if (ext.ToolbarComponent) {
          const CustomToolbarComp = ext.ToolbarComponent;
          content = (
            <CustomToolbarComp
              editor={editor}
              disabled={props.disabled}
              config={config}
              isDialogOpen={isDialogOpen}
              onOpenDialog={handleOpenDialog}
              onCloseDialog={handleCloseDialog}
            />
          );
        } else if (ext.toolbarButton) {
          const button = ext.toolbarButton;
          content = (
            <ToolbarButton
              onClick={() => {
                if (button.onClick) {
                  button.onClick(editor, { openDialog: handleOpenDialog });
                } else {
                  handleOpenDialog();
                }
              }}
              icon={button.icon}
              tooltip={button.tooltip || button.label}
              active={button.isActive ? button.isActive(editor) : isDialogOpen}
              disabled={!editor || props.disabled}
            />
          );
        }

        const overlay = ext.DialogComponent ? (
          <ext.DialogComponent
            editor={editor}
            open={isDialogOpen}
            onClose={handleCloseDialog}
            config={config}
          />
        ) : undefined;

        return { id: `custom-${ext.id}`, content, overlay };
      });

    const typography = useTypographyControls(editor, {
      disabled: props.disabled,
      fonts: getFeatureOptions(config.fontFamily, {} as FontFamilyConfig)?.fonts,
      sizes: getFeatureOptions(config.fontSize, {} as FontSizeConfig)?.sizes,
      heights: getFeatureOptions(config.lineHeight, {} as LineHeightConfig)?.heights,
    });
    const semanticMarks = useSemanticMarks(editor, { disabled: props.disabled });

    const toolbarItemCandidates: Array<ToolbarItem | false | undefined> = [
      config.heading && {
        id: 'heading',
        content: (
          <>
            {heading.headingSelect}
            {heading.headingTagSelect}
          </>
        ),
      },
      config.fontFamily && { id: 'fontFamily', content: typography.fontFamilySelect },
      config.fontSize && { id: 'fontSize', content: typography.fontSizeSelect },
      config.lineHeight && { id: 'lineHeight', content: typography.lineHeightSelect },
      (config.fontFamily || config.fontSize || config.lineHeight) && {
        id: 'typographySpacer',
        content: <Spacer margin={1} />,
      },
      config.bold && { id: 'bold', content: starterKit.boldButton },
      config.italic && { id: 'italic', content: starterKit.italicButton },
      config.underline && { id: 'underline', content: starterKit.underlineButton },
      (config.bold || config.italic || config.underline) && {
        id: 'basicTextSpacer',
        content: <Spacer margin={1} />,
      },
      config.strike && { id: 'strike', content: starterKit.strikeButton },
      config.superscript && { id: 'superscript', content: script.superscriptButton },
      config.subscript && { id: 'subscript', content: script.subscriptButton },
      config.textColor && { id: 'textColor', content: textColor.textColorButton },
      config.highlightColor && { id: 'highlightColor', content: highlightColor.highlightColorButton },
      (config.strike || config.superscript || config.subscript || config.textColor || config.highlightColor) && {
        id: 'textDecorationSpacer',
        content: <Spacer margin={1} />,
      },
      config.clearFormatting && { id: 'clearFormatting', content: typography.clearFormattingButton },
      config.leadParagraph && { id: 'leadParagraph', content: semanticMarks.leadParagraphButton },
      config.abbr && {
        id: 'abbr',
        content: (
          <>
            {semanticMarks.abbrButton}
            {semanticMarks.abbrDialog}
          </>
        ),
      },
      config.language && {
        id: 'language',
        content: (
          <>
            {semanticMarks.languageButton}
            {semanticMarks.languageDialog}
          </>
        ),
      },
      (config.clearFormatting || config.leadParagraph || config.abbr || config.language) && {
        id: 'semanticSpacer',
        content: <Spacer margin={1} />,
      },
      config.textAlign && {
        id: 'textAlign',
        content: textAlign.textAlignDropdown,
      },
      config.textAlign && { id: 'textAlignSpacer', content: <Spacer margin={1} /> },
      config.bulletList && { id: 'bullet', content: starterKit.bulletButton },
      config.orderedList && { id: 'ordered', content: starterKit.orderedButton },
      (config.bulletList || config.orderedList) && {
        id: 'listSpacer',
        content: <Spacer margin={1} />,
      },
      config.code && { id: 'code', content: starterKit.codeButton },
      config.blockquote && { id: 'blockquote', content: starterKit.blockquoteButton },
      config.link && {
        id: 'link',
        content: link.linkButton,
        overlay: link.linkDialog,
      },
      config.mediaLibrary && {
        id: 'mediaLibrary',
        content: image.imageButton,
        overlay: image.imageDialog,
      },
      config.linker && {
        id: 'linker',
        content: (
          <>
            {linker.linkerButton}
            {linker.linkerDialog}
          </>
        ),
      },
      config.video && {
        id: 'video',
        content: (
          <>
            {video.videoButton}
            {video.videoDialog}
          </>
        ),
      },
      config.audio && {
        id: 'audio',
        content: (
          <>
            {audio.audioButton}
            {audio.audioDialog}
          </>
        ),
      },
      config.attachment && {
        id: 'attachment',
        content: (
          <>
            {attachment.attachmentButton}
            {attachment.attachmentDialog}
          </>
        ),
      },
      config.iframe && {
        id: 'iframe',
        content: (
          <>
            {iframe.iframeButton}
            {iframe.iframeDialog}
          </>
        ),
      },
      (config.code ||
        config.blockquote ||
        config.link ||
        config.mediaLibrary ||
        config.linker ||
        config.video ||
        config.audio ||
        config.attachment ||
        config.iframe) && {
        id: 'insertSpacer',
        content: <Spacer margin={1} />,
      },
      config.table && {
        id: 'table',
        content: (
          <>
            {table.tableButton}
            {table.addColumnButton}
            {table.removeColumnButton}
            {table.addRowButton}
            {table.removeRowButton}
          </>
        ),
        overlay: table.tableDialog,
      },
      ...customExtensionToolbarItems,
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
          toolbarRef={toolbarRef}
          onToolbarKeyDown={handleToolbarKeyDown}
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
  attribute?: { options?: { preset?: string } };
};

const RichTextInput = forwardRef<HTMLDivElement, RichTextInputProps>((props, forwardedRef) => {
  const { formatMessage } = useIntl();
  const rawPresetName = props.attribute?.options?.preset;
  const normalizedPresetName = rawPresetName?.trim() || undefined;

  const [runtimeSettings, setRuntimeSettings] = useState<TiptapRuntimeSettings>(
    DEFAULT_RUNTIME_SETTINGS
  );
  const [isSettingsLoading, setIsSettingsLoading] = useState<boolean>(true);
  const effectivePresetName = normalizedPresetName ?? runtimeSettings.defaultPreset;
  const { config, isLoading } = usePresetConfig(
    isSettingsLoading && !normalizedPresetName ? undefined : effectivePresetName
  );

  useEffect(() => {
    let mounted = true;
    Promise.resolve()
      .then(() => {
        if (typeof getFetchClient !== 'function') return undefined;
        return getFetchClient().get('/tiptap-editor/settings');
      })
      .then(
        (res: { data?: { defaultPreset?: string; enableRelationalSync?: boolean } } | undefined) => {
          if (!mounted) return;
          setRuntimeSettings({
            ...DEFAULT_RUNTIME_SETTINGS,
            ...(typeof res?.data?.defaultPreset === 'string' &&
            res.data.defaultPreset.trim().length > 0
              ? { defaultPreset: res.data.defaultPreset.trim() }
              : {}),
            ...(typeof res?.data?.enableRelationalSync === 'boolean'
              ? { enableRelationalSync: res.data.enableRelationalSync }
              : {}),
          });
          setIsSettingsLoading(false);
        }
      )
      .catch(() => {
        if (mounted) {
          setRuntimeSettings(DEFAULT_RUNTIME_SETTINGS);
          setIsSettingsLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading || isSettingsLoading) {
    return (
      <Box padding={4}>
        {formatMessage({ id: 'tiptap-editor.loading', defaultMessage: 'Loading editor...' })}
      </Box>
    );
  }

  return (
    <InnerEditor
      ref={forwardedRef}
      {...props}
      config={config ?? MINIMAL_PRESET_CONFIG}
      presetName={effectivePresetName}
      relationalSyncEnabled={runtimeSettings.enableRelationalSync}
    />
  );
});

export default RichTextInput;
