import React, { useState } from 'react';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Flex, Popover } from '@strapi/design-system';

import { TextAlignLeft } from '../icons/TextAlignLeft';
import { TextAlignJustify } from '../icons/TextAlignJustify';
import { TextAlignRight } from '../icons/TextAlignRight';
import { TextAlignCenter } from '../icons/TextAlignCenter';
import { ToolbarButton } from '../components/ToolbarButton';
import { useIntl } from 'react-intl';

type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * Provides toolbar toggle buttons and a compact Edifice dropdown for paragraph and heading text alignment.
 */
export function useTextAlign(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return {
          isTextAlignLeft: false,
          isTextAlignRight: false,
          isTextAlignCenter: false,
          isTextAlignJustify: false,
          canToggleAlign: false,
        };
      }
      return {
        isTextAlignLeft: ctx.editor.isActive({ textAlign: 'left' }) ?? false,
        isTextAlignRight: ctx.editor.isActive({ textAlign: 'right' }) ?? false,
        isTextAlignCenter: ctx.editor.isActive({ textAlign: 'center' }) ?? false,
        isTextAlignJustify: ctx.editor.isActive({ textAlign: 'justify' }) ?? false,
        canToggleAlign: typeof ctx.editor.commands.setTextAlign === 'function',
      };
    },
  });

  const setTextAlign = (alignment: TextAlign) => {
    editor?.chain().focus().setTextAlign(alignment).run();
    setOpen(false);
  };

  const isDisabled = props.disabled || !editor || !editorState?.canToggleAlign;

  const activeAlignIcon = editorState?.isTextAlignCenter ? (
    <TextAlignCenter />
  ) : editorState?.isTextAlignRight ? (
    <TextAlignRight />
  ) : editorState?.isTextAlignJustify ? (
    <TextAlignJustify />
  ) : (
    <TextAlignLeft />
  );

  const textAlignLeftButton = (
    <ToolbarButton
      onClick={() => setTextAlign('left')}
      icon={<TextAlignLeft />}
      active={editorState?.isTextAlignLeft ?? false}
      toggle
      disabled={isDisabled}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.textAlignLeft',
        defaultMessage: 'Text Align Left',
      })}
    />
  );

  const textAlignCenterButton = (
    <ToolbarButton
      onClick={() => setTextAlign('center')}
      icon={<TextAlignCenter />}
      active={editorState?.isTextAlignCenter ?? false}
      toggle
      disabled={isDisabled}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.textAlignCenter',
        defaultMessage: 'Text Align Center',
      })}
    />
  );

  const textAlignRightButton = (
    <ToolbarButton
      onClick={() => setTextAlign('right')}
      icon={<TextAlignRight />}
      active={editorState?.isTextAlignRight ?? false}
      toggle
      disabled={isDisabled}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.textAlignRight',
        defaultMessage: 'Text Align Right',
      })}
    />
  );

  const textAlignJustifyButton = (
    <ToolbarButton
      onClick={() => setTextAlign('justify')}
      icon={<TextAlignJustify />}
      active={editorState?.isTextAlignJustify ?? false}
      toggle
      disabled={isDisabled}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.textAlignJustify',
        defaultMessage: 'Text Align Justify',
      })}
    />
  );

  const textAlignLabel = formatMessage({
    id: 'tiptap-editor.toolbar.textAlign',
    defaultMessage: 'Text Alignment',
  });

  const renderAlignTrigger = () => (
    <button
      type="button"
      disabled={isDisabled}
      aria-label={textAlignLabel}
      title={textAlignLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        height: '32px',
        padding: '0 8px',
        borderRadius: '4px',
        border: '1px solid transparent',
        background: open ? 'rgba(73, 69, 255, 0.1)' : 'transparent',
        color: 'inherit',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', width: 16, height: 16 }}>
        {activeAlignIcon}
      </span>
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M3 4.5L6 7.5L9 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  const textAlignDropdown = (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>{renderAlignTrigger()}</Popover.Trigger>
      <Popover.Content side="bottom" align="start" sideOffset={4}>
        <Flex gap={1} padding={1} alignItems="center">
          {textAlignLeftButton}
          {textAlignCenterButton}
          {textAlignRightButton}
          {textAlignJustifyButton}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );

  return {
    textAlignTrigger: renderAlignTrigger(),
    textAlignDropdown,
    textAlignLeftButton,
    textAlignCenterButton,
    textAlignRightButton,
    textAlignJustifyButton,
  };
}

