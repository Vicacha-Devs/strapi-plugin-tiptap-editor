import React, { useEffect, useState } from 'react';
import { Editor, useEditorState } from '@tiptap/react';
import { Box, Flex } from '@strapi/design-system';
import { Collapse, Expand, Eye } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { getPluginId } from '../utils/getTranslation';
import { ToolbarButton } from './ToolbarButton';

export interface EditorModesOptions {
  disabled?: boolean;
  characterLimit?: number | null;
  wordsPerMinute?: number;
  showCharacterCount?: boolean;
  showFullscreen?: boolean;
}

/**
 * Calculates estimated reading time in minutes for a given word count.
 * Defaults to 200 words per minute and rounds up to at least 1 minute when content is non-empty.
 */
export const calculateReadingTimeMinutes = (
  wordCount: number,
  wordsPerMinute: number = 200
): number => {
  if (!Number.isFinite(wordCount) || wordCount <= 0) {
    return 0;
  }
  const safeWpm = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : 200;
  return Math.max(1, Math.ceil(wordCount / safeWpm));
};

/**
 * Provides Fullscreen mode, Read-only Preview mode, and Character/Word Count + Reading Time status bar at the bottom of the field.
 */
export const useEditorModes = (editor: Editor | null, options?: EditorModesOptions) => {
  const { formatMessage } = useIntl();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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
    const nextEditable = !isPreviewMode;
    if (editor.isEditable !== nextEditable) {
      editor.setEditable(nextEditable, false);
    }
    return () => {
      if (isPreviewMode && !editor.isDestroyed) editor.setEditable(true, false);
    };
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
      onClick={() => setIsFullscreen((prev) => !prev)}
      disabled={!editor}
      tooltip={fullscreenTooltip}
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
      onClick={() => setIsPreviewMode((prev) => !prev)}
      disabled={!editor || options?.disabled}
      tooltip={previewTooltip}
    />
  );

  const limit = options?.characterLimit && options.characterLimit > 0 ? options.characterLimit : null;
  const charCount = stats?.characters ?? 0;
  const wordCount = stats?.words ?? 0;
  const readingTimeMinutes = calculateReadingTimeMinutes(wordCount, options?.wordsPerMinute);
  const ratio = limit ? Math.min((charCount / limit) * 100, 100) : 0;
  const isOverLimit = limit ? charCount > limit : false;
  const isNearLimit = limit ? charCount >= limit * 0.9 : false;
  const showFooter = options?.showCharacterCount ?? true;

  const characterCountFooter = showFooter ? (
    <Box
      className="editor-footer"
      paddingTop={2}
      paddingBottom={2}
      paddingLeft={2}
      paddingRight={2}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        borderTop: '1px solid rgba(128, 128, 128, 0.2)',
        color: isOverLimit ? '#d02b20' : isNearLimit ? '#d9822f' : '#666687',
      }}
      aria-live="polite"
    >
      <Flex gap={3} alignItems="center" wrap="wrap">
        <span>
          {formatMessage(
            {
              id: `${getPluginId()}.footer.wordsCount`,
              defaultMessage: '{count} {count, plural, one {word} other {words}}',
            },
            { count: wordCount }
          )}
        </span>
        <span aria-hidden="true">·</span>
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
        <span aria-hidden="true">·</span>
        <span>
          {formatMessage(
            {
              id: `${getPluginId()}.footer.readingTime`,
              defaultMessage: '~{minutes} min read',
            },
            { minutes: readingTimeMinutes }
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
          aria-label={formatMessage({
            id: `${getPluginId()}.footer.characterLimitProgress`,
            defaultMessage: 'Character limit usage',
          })}
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

  return {
    isFullscreen,
    isPreviewMode,
    fullscreenButton,
    previewButton,
    characterCountFooter,
  };
};
