import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Expand, Eye, Code } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from './ToolbarButton';
import { extractRelationsFromJSON } from '../../../shared/relations';
import { jsonToMarkdown } from '../../../shared/contentSerializer';

export function useEditorModes(
  editor: Editor | null,
  props: {
    disabled?: boolean;
    characterLimit?: number | null;
    showCharacterCount?: boolean;
  } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const stats = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return { characters: 0, words: 0 };
      }
      const text = ctx.editor.getText() || '';
      const characters = text.length;
      const trimmed = text.trim();
      const words = trimmed ? trimmed.split(/\s+/).length : 0;
      return { characters, words };
    },
  });

  const characters = stats?.characters ?? 0;
  const words = stats?.words ?? 0;
  const limit = props.characterLimit ?? null;
  const isOverLimit = typeof limit === 'number' && limit > 0 && characters > limit;

  const fullscreenButton = (
    <ToolbarButton
      onClick={() => setIsFullscreen((f) => !f)}
      icon={<Expand />}
      active={isFullscreen}
      disabled={!editor}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.fullscreen',
        defaultMessage: isFullscreen ? 'Exit fullscreen' : 'Fullscreen mode',
      })}
    />
  );

  const previewButton = (
    <ToolbarButton
      onClick={() => {
        setShowPreview((p) => !p);
        setShowSource(false);
      }}
      icon={<Eye />}
      active={showPreview}
      disabled={!editor}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.preview',
        defaultMessage: 'Toggle Edifice IO summary preview',
      })}
    />
  );

  const sourceButton = (
    <ToolbarButton
      onClick={() => {
        setShowSource((s) => !s);
        setShowPreview(false);
      }}
      icon={<Code />}
      active={showSource}
      disabled={!editor}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.source',
        defaultMessage: 'Inspect JSON / HTML / Markdown output',
      })}
    />
  );

  const renderInspectorDrawer = () => {
    if (!editor || (!showPreview && !showSource)) return null;
    const jsonDoc = editor.getJSON();
    const relations = extractRelationsFromJSON(jsonDoc);

    if (showPreview) {
      return (
        <div
          role="region"
          aria-label="Editor Preview Summary"
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #dcdce4',
            backgroundColor: '#f6f6f9',
            fontSize: '1.3rem',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '6px', color: '#32324d' }}>
            📋 Edifice IO Content & Relations Summary
          </div>
          <div style={{ color: '#4a4a6a', marginBottom: '8px' }}>
            {editor.getText().slice(0, 280) || 'Empty document'}
            {editor.getText().length > 280 ? '…' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '1.2rem' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: '#e0e0ff',
                color: '#271fe0',
                fontWeight: 600,
              }}
            >
              Synced Media Assets: {relations.mediaAssets.length}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: '#eafbe7',
                color: '#2f6846',
                fontWeight: 600,
              }}
            >
              Synced Internal Links: {relations.internalLinks.length}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        role="region"
        aria-label="Source Output Inspector"
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #dcdce4',
          backgroundColor: '#212134',
          color: '#f6f6f9',
          fontSize: '1.2rem',
          maxHeight: '240px',
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '6px', color: '#a5a5ba' }}>
          ProseMirror JSON / Markdown Preview
        </div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(jsonDoc, null, 2)}
        </pre>
        <div style={{ fontWeight: 700, margin: '10px 0 4px', color: '#a5a5ba' }}>
          Markdown Serialization:
        </div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {jsonToMarkdown(jsonDoc)}
        </pre>
      </div>
    );
  };

  const characterCountFooter = props.showCharacterCount ? (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        borderTop: '1px solid #eaeaea',
        backgroundColor: '#f6f6f9',
        fontSize: '1.2rem',
        color: isOverLimit ? '#b72b1a' : '#666687',
        fontWeight: isOverLimit ? 700 : 400,
      }}
    >
      <span>
        {words} {words === 1 ? 'word' : 'words'} · {characters}{' '}
        {characters === 1 ? 'character' : 'characters'}
        {limit ? ` / ${limit} limit` : ''}
      </span>
      {isOverLimit && <span role="alert">⚠️ Character limit exceeded</span>}
    </div>
  ) : null;

  return {
    isFullscreen,
    fullscreenButton,
    previewButton,
    sourceButton,
    inspectorDrawer: renderInspectorDrawer(),
    characterCountFooter,
  };
}
