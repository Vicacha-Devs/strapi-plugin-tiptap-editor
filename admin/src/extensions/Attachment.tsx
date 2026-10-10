import React, { useState } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { IconButton, Popover, TextInput } from '@strapi/design-system';
import { Paperclip, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';
import { MediaLibraryWrapper, type StrapiFile } from '../components/MediaLibraryWrapper';
import { isSafeUrl } from '../../../shared/contentSerializer';

export interface StrapiAttachmentOptions {
  enableContentCheck: boolean;
  HTMLAttributes: Record<string, unknown>;
}

export function formatAttachmentSize(sizeInKB: number | string | null | undefined): string {
  const num = typeof sizeInKB === 'string' ? parseFloat(sizeInKB) : sizeInKB;
  if (typeof num !== 'number' || Number.isNaN(num) || num <= 0) return '';
  if (num >= 1024) {
    return `${(num / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(num)} KB`;
}

export function AttachmentNodeViewReadOnly({ node }: NodeViewProps) {
  const { href, src, filename, title, mime, size, ext } = node.attrs;
  const rawUrl = href || src || '';
  const safeHref = isSafeUrl(rawUrl) ? rawUrl : '#';
  const displayName = title || filename || 'Attachment';
  const badge = (ext ? String(ext).replace(/^\./, '') : mime ? String(mime).split('/')[1] : 'FILE')
    .toUpperCase()
    .slice(0, 8);
  const formattedSize = formatAttachmentSize(size);

  return (
    <NodeViewWrapper data-drag-handle data-type="attachment">
      <div
        className="tiptap-attachment-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 14px',
          margin: '0.75em 0',
          backgroundColor: '#f6f6f9',
          border: '1px solid #dcdce4',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span
            style={{
              backgroundColor: '#4945ff',
              color: '#fff',
              fontSize: '1.1rem',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: '4px',
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 600,
                color: '#32324d',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            {formattedSize && (
              <div style={{ fontSize: '1.2rem', color: '#666687' }}>{formattedSize}</div>
            )}
          </div>
        </div>
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          download={filename || true}
          aria-label={`Download ${displayName}`}
          style={{
            fontSize: '1.3rem',
            fontWeight: 600,
            color: '#4945ff',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          ↓ Download
        </a>
      </div>
    </NodeViewWrapper>
  );
}

export function AttachmentNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const { formatMessage } = useIntl();
  const [openPopover, setOpenPopover] = useState(false);
  const [title, setTitle] = useState<string>(node.attrs.title ?? node.attrs.filename ?? '');

  return (
    <NodeViewWrapper data-drag-handle data-type="attachment">
      <Popover.Root open={openPopover} onOpenChange={setOpenPopover}>
        <Popover.Anchor>
          <div
            onClick={() => setOpenPopover(true)}
            style={{
              outline: selected ? '2px solid #4945ff' : undefined,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <AttachmentNodeViewReadOnly {...props} />
          </div>
        </Popover.Anchor>
        <Popover.Content side="bottom">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              minWidth: '240px',
            }}
          >
            <TextInput
              placeholder={formatMessage({
                id: 'tiptap-editor.attachment.title',
                defaultMessage: 'Attachment label',
              })}
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              onBlur={() => updateAttributes({ title: title || null })}
              aria-label={formatMessage({
                id: 'tiptap-editor.attachment.title',
                defaultMessage: 'Attachment label',
              })}
            />
            <IconButton
              onClick={deleteNode}
              label={formatMessage({
                id: 'tiptap-editor.attachment.delete',
                defaultMessage: 'Remove attachment',
              })}
            >
              <Trash />
            </IconButton>
          </div>
        </Popover.Content>
      </Popover.Root>
    </NodeViewWrapper>
  );
}

export const StrapiAttachment = Node.create<StrapiAttachmentOptions>({
  name: 'attachment',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      enableContentCheck: false,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      href: { default: null },
      src: { default: null },
      filename: { default: null },
      title: { default: null },
      mime: { default: null },
      size: { default: null },
      ext: { default: null },
      'data-asset-id': {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const raw = el.getAttribute('data-asset-id');
          if (!raw) return null;
          const n = parseInt(raw, 10);
          return Number.isNaN(n) ? null : n;
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['data-asset-id'] != null ? { 'data-asset-id': String(attrs['data-asset-id']) } : {},
      },
      'data-document-id': {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-document-id') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['data-document-id']
            ? { 'data-document-id': String(attrs['data-document-id']) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="attachment"]' }, { tag: 'a[data-attachment="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.title || HTMLAttributes.filename || 'Attachment');
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'attachment',
      }),
      label,
    ];
  },

  addNodeView() {
    if (this.options.enableContentCheck) {
      return ReactNodeViewRenderer(AttachmentNodeViewReadOnly);
    }
    return ReactNodeViewRenderer(AttachmentNodeView);
  },
});

export function useAttachment(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const [showPicker, setShowPicker] = useState(false);
  const { formatMessage } = useIntl();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  const handleSelectAssets = (assets: StrapiFile[]) => {
    const asset = assets[0];
    const url = asset?.url?.trim();
    if (!asset || !editor || !url) {
      setShowPicker(false);
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'attachment',
        attrs: {
          href: url,
          src: url,
          filename: asset.name,
          title: asset.alternativeText || asset.name,
          mime: asset.mime ?? null,
          size: asset.size ?? null,
          ext: asset.ext ?? null,
          'data-asset-id': asset.id,
          'data-document-id': asset.documentId ?? null,
        },
      })
      .createParagraphNear()
      .run();

    setShowPicker(false);
  };

  const attachmentButton = (
    <ToolbarButton
      onClick={() => setShowPicker(true)}
      icon={<Paperclip />}
      active={false}
      disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.insertAttachment',
        defaultMessage: 'Insert file attachment',
      })}
    />
  );

  const attachmentDialog = (
    <MediaLibraryWrapper
      open={showPicker}
      onClose={() => setShowPicker(false)}
      onSelectAssets={handleSelectAssets}
      allowedTypes={['files', 'images', 'videos', 'audios']}
    />
  );

  return { attachmentButton, attachmentDialog };
}
