import React, { useEffect, useState } from 'react';
import { Editor, useEditorState } from '@tiptap/react';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Collapse, Expand, Eye } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from './ToolbarButton';
import { getPluginId } from '../utils/getTranslation';
import { jsonToMarkdown, sanitizeHtmlString } from '../../../shared/contentSerializer';

export interface EditorModesOptions {
  disabled?: boolean;
  characterLimit?: number | null;
  showCharacterCount?: boolean;
  showFullscreen?: boolean;
}

/**
 * Provides Fullscreen mode, Read-only Preview mode, Source/JSON/HTML/Markdown Inspector,
 * and Character/Word Count status bar.
 */
export const useEditorModes = (editor: Editor | null, options?: EditorModesOptions) => {
  const { formatMessage } = useIntl();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'json' | 'html' | 'markdown'>('json');

  // Exit fullscreen on Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Toggle editor editable state when preview mode changes
  useEffect(() => {
    if (!editor || options?.disabled) return;
    editor.setEditable(!isPreviewMode);
  }, [editor, isPreviewMode, options?.disabled]);

  const stats = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return { characters: 0, words: 0 };
      }
      const storage = ctx.editor.storage as unknown as {
        characterCount?: { characters?: () => number; words?: () => number };
      };
      const text = ctx.editor.state.doc.textContent || '';
      const characters =
        typeof storage?.characterCount?.characters === 'function'
          ? storage.characterCount.characters()
          : text.length;
      const words =
        typeof storage?.characterCount?.words === 'function'
          ? storage.characterCount.words()
          : text.trim()
            ? text.trim().split(/\s+/).length
            : 0;
      return { characters, words };
    },
  });

  const fullscreenTooltip = isFullscreen
    ? formatMessage({
        id: `${getPluginId()}.toolbar.fullscreen.exit`,
        defaultMessage: 'Exit Fullscreen (Esc)',
      })
    : formatMessage({
        id: `${getPluginId()}.toolbar.fullscreen.enter`,
        defaultMessage: 'Fullscreen Mode',
      });

  const fullscreenButton = (
    <ToolbarButton
      icon={isFullscreen ? <Collapse /> : <Expand />}
      active={isFullscreen}
      toggle
      onClick={() => setIsFullscreen((prev) => !prev)}
      disabled={!editor}
      tooltip={fullscreenTooltip}
      ariaLabel={fullscreenTooltip}
    />
  );

  const previewTooltip = formatMessage({
    id: `${getPluginId()}.toolbar.preview`,
    defaultMessage: 'Read-Only Preview Mode',
  });

  const previewButton = (
    <ToolbarButton
      icon={<Eye />}
      active={isPreviewMode}
      toggle
      onClick={() => setIsPreviewMode((prev) => !prev)}
      disabled={!editor || options?.disabled}
      tooltip={previewTooltip}
      ariaLabel={previewTooltip}
    />
  );

  const sourceTooltip = formatMessage({
    id: `${getPluginId()}.toolbar.sourceInspector`,
    defaultMessage: 'Inspect JSON / HTML / Markdown',
  });

  const sourceButton = (
    <ToolbarButton
      icon={<span style={{ fontWeight: 700, fontSize: '10px', fontFamily: 'monospace' }}>{'{}'}</span>}
      active={showInspector}
      toggle
      onClick={() => setShowInspector((prev) => !prev)}
      disabled={!editor}
      tooltip={sourceTooltip}
      ariaLabel={sourceTooltip}
    />
  );

  const limit = options?.characterLimit && options.characterLimit > 0 ? options.characterLimit : null;
  const charCount = stats?.characters ?? 0;
  const wordCount = stats?.words ?? 0;
  const ratio = limit ? Math.min((charCount / limit) * 100, 100) : 0;
  const isOverLimit = limit ? charCount > limit : false;
  const isNearLimit = limit ? charCount >= limit * 0.9 : false;

  const characterCountFooter = options?.showCharacterCount ? (
    <Box
      paddingTop={2}
      paddingLeft={2}
      paddingRight={2}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: isOverLimit ? '#d02b20' : isNearLimit ? '#d9822f' : '#666687',
      }}
      aria-live="polite"
    >
      <Flex gap={3} alignItems="center">
        <span>
          {formatMessage(
            {
              id: `${getPluginId()}.footer.wordsCount`,
              defaultMessage: '{count} {count, plural, one {word} other {words}}',
            },
            { count: wordCount }
          )}
        </span>
        <span>
          {limit
            ? formatMessage(
                {
                  id: `${getPluginId()}.footer.charactersWithLimit`,
                  defaultMessage: '{count} / {limit} characters',
                },
                { count: charCount, limit }
              )
            : formatMessage(
                {
                  id: `${getPluginId()}.footer.charactersCount`,
                  defaultMessage: '{count} {count, plural, one {character} other {characters}}',
                },
                { count: charCount }
              )}
        </span>
        {isPreviewMode && (
          <span
            style={{
              background: '#e0e0ff',
              color: '#4945ff',
              padding: '1px 6px',
              borderRadius: '999px',
              fontWeight: 600,
              fontSize: '11px',
            }}
          >
            {formatMessage({
              id: `${getPluginId()}.footer.previewBadge`,
              defaultMessage: 'Preview Mode (Read-Only)',
            })}
          </span>
        )}
      </Flex>

      {limit && (
        <div
          style={{
            width: '100px',
            height: '6px',
            background: '#eaeaef',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
          role="progressbar"
          aria-valuenow={charCount}
          aria-valuemin={0}
          aria-valuemax={limit}
        >
          <div
            style={{
              width: `${ratio}%`,
              height: '100%',
              background: isOverLimit ? '#d02b20' : isNearLimit ? '#d9822f' : '#4945ff',
              transition: 'width 0.15s ease',
            }}
          />
        </div>
      )}
    </Box>
  ) : null;

  const getInspectorOutput = () => {
    if (!editor) return '';
    if (inspectorTab === 'json') {
      return JSON.stringify(editor.getJSON(), null, 2);
    }
    if (inspectorTab === 'html') {
      return sanitizeHtmlString(editor.getHTML());
    }
    return jsonToMarkdown(editor.getJSON() as any);
  };

  const inspectorDrawer = showInspector && editor ? (
    <Box
      padding={3}
      marginTop={2}
      background="neutral150"
      hasRadius
      borderColor="neutral300"
    >
      <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
        <Typography variant="sigma" textColor="neutral700">
          {formatMessage({
            id: `${getPluginId()}.inspector.title`,
            defaultMessage: 'Content Output Inspector',
          })}
        </Typography>
        <Flex gap={1}>
          <Button
            size="S"
            variant={inspectorTab === 'json' ? 'secondary' : 'tertiary'}
            onClick={() => setInspectorTab('json')}
          >
            {formatMessage({
              id: `${getPluginId()}.inspector.tabJson`,
              defaultMessage: 'JSON',
            })}
          </Button>
          <Button
            size="S"
            variant={inspectorTab === 'html' ? 'secondary' : 'tertiary'}
            onClick={() => setInspectorTab('html')}
          >
            {formatMessage({
              id: `${getPluginId()}.inspector.tabHtml`,
              defaultMessage: 'HTML',
            })}
          </Button>
          <Button
            size="S"
            variant={inspectorTab === 'markdown' ? 'secondary' : 'tertiary'}
            onClick={() => setInspectorTab('markdown')}
          >
            {formatMessage({
              id: `${getPluginId()}.inspector.tabMarkdown`,
              defaultMessage: 'Markdown',
            })}
          </Button>
        </Flex>
      </Flex>
      <pre
        style={{
          margin: 0,
          padding: '10px',
          background: '#212134',
          color: '#f6f6f9',
          borderRadius: '4px',
          fontSize: '12px',
          maxHeight: '240px',
          overflow: 'auto',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {getInspectorOutput()}
      </pre>
    </Box>
  ) : null;

  return {
    isFullscreen,
    isPreviewMode,
    fullscreenButton,
    previewButton,
    sourceButton,
    characterCountFooter,
    inspectorDrawer,
  };
};
