import React, { useState } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Button, Dialog, Field, IconButton, Popover, TextInput } from '@strapi/design-system';
import { Play, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';
import { MediaLibraryWrapper, type StrapiFile } from '../components/MediaLibraryWrapper';
import { isSafeUrl } from '../../../shared/contentSerializer';

export interface StrapiVideoOptions {
  enableContentCheck: boolean;
  HTMLAttributes: Record<string, unknown>;
}

export function normalizeVideoEmbedUrl(rawUrl: string): {
  src: string;
  embedType: 'file' | 'embed';
} | null {
  const trimmed = rawUrl.trim();
  if (!isSafeUrl(trimmed)) {
    return null;
  }
  const ytMatch =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/.exec(
      trimmed
    );
  if (ytMatch?.[1]) {
    return {
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
      embedType: 'embed',
    };
  }
  const vimeoMatch = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/.exec(trimmed);
  if (vimeoMatch?.[1]) {
    return {
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      embedType: 'embed',
    };
  }
  return { src: trimmed, embedType: 'file' };
}

export function VideoNodeViewReadOnly({ node }: NodeViewProps) {
  const { src, title, caption, width, height, embedType } = node.attrs;
  const align = node.attrs['data-align'] ?? undefined;
  const safeSrc = isSafeUrl(src) ? src : '';

  return (
    <NodeViewWrapper data-drag-handle data-align={align} data-type="video">
      <figure style={{ margin: '0.75em 0' }}>
        {embedType === 'embed' ? (
          <iframe
            src={safeSrc}
            title={title || 'Embedded video'}
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allowFullScreen
            style={{
              width: width ? `${width}px` : '100%',
              height: height ? `${height}px` : '360px',
              border: 0,
              borderRadius: '6px',
            }}
          />
        ) : (
          <video
            src={safeSrc}
            controls
            preload="metadata"
            title={title || undefined}
            style={{
              maxWidth: '100%',
              width: width ? `${width}px` : '100%',
              height: height ? `${height}px` : 'auto',
              borderRadius: '6px',
              display: 'block',
            }}
          />
        )}
        {caption && (
          <figcaption style={{ fontSize: '1.2rem', color: '#666687', marginTop: '4px' }}>
            {caption}
          </figcaption>
        )}
      </figure>
    </NodeViewWrapper>
  );
}

export function VideoNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const { formatMessage } = useIntl();
  const [openPopover, setOpenPopover] = useState(false);
  const [caption, setCaption] = useState<string>(node.attrs.caption ?? '');
  const [title, setTitle] = useState<string>(node.attrs.title ?? '');

  return (
    <NodeViewWrapper
      data-drag-handle
      data-align={node.attrs['data-align'] ?? undefined}
      data-type="video"
    >
      <Popover.Root open={openPopover} onOpenChange={setOpenPopover}>
        <Popover.Anchor>
          <div
            onClick={() => setOpenPopover(true)}
            style={{
              outline: selected ? '2px solid #4945ff' : undefined,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <VideoNodeViewReadOnly {...props} />
          </div>
        </Popover.Anchor>
        <Popover.Content side="bottom">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px',
              minWidth: '260px',
            }}
          >
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['left', 'center', 'right'] as const).map((al) => (
                <Button
                  key={al}
                  size="S"
                  variant={node.attrs['data-align'] === al ? 'secondary' : 'tertiary'}
                  onClick={() =>
                    updateAttributes({
                      'data-align': node.attrs['data-align'] === al ? null : al,
                    })
                  }
                >
                  {al}
                </Button>
              ))}
              <IconButton
                onClick={deleteNode}
                label={formatMessage({
                  id: 'tiptap-editor.video.delete',
                  defaultMessage: 'Delete video',
                })}
              >
                <Trash />
              </IconButton>
            </div>
            <TextInput
              placeholder={formatMessage({
                id: 'tiptap-editor.video.title',
                defaultMessage: 'Accessible video title',
              })}
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              onBlur={() => updateAttributes({ title: title || null })}
              aria-label={formatMessage({
                id: 'tiptap-editor.video.title',
                defaultMessage: 'Accessible video title',
              })}
            />
            <TextInput
              placeholder={formatMessage({
                id: 'tiptap-editor.video.caption',
                defaultMessage: 'Video caption',
              })}
              value={caption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaption(e.target.value)}
              onBlur={() => updateAttributes({ caption: caption || null })}
              aria-label={formatMessage({
                id: 'tiptap-editor.video.caption',
                defaultMessage: 'Video caption',
              })}
            />
          </div>
        </Popover.Content>
      </Popover.Root>
    </NodeViewWrapper>
  );
}

export const StrapiVideo = Node.create<StrapiVideoOptions>({
  name: 'video',
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
      src: { default: null },
      title: { default: null },
      caption: { default: null },
      width: { default: null },
      height: { default: null },
      embedType: { default: 'file' },
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
      'data-align': {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['data-align'] ? { 'data-align': String(attrs['data-align']) } : {},
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'video[src]' },
      { tag: 'div[data-type="video"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { controls: 'true' }),
    ];
  },

  addNodeView() {
    if (this.options.enableContentCheck) {
      return ReactNodeViewRenderer(VideoNodeViewReadOnly);
    }
    return ReactNodeViewRenderer(VideoNodeView);
  },
});

export function useVideo(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  const handleSelectAssets = (assets: StrapiFile[]) => {
    const asset = assets[0];
    const src = asset?.url?.trim();
    if (!asset || !editor || !src) {
      setShowMediaPicker(false);
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'video',
        attrs: {
          src,
          title: asset.alternativeText ?? asset.name ?? 'Video',
          caption: asset.caption ?? null,
          embedType: 'file',
          'data-asset-id': asset.id,
          'data-document-id': asset.documentId ?? null,
        },
      })
      .createParagraphNear()
      .run();

    setShowMediaPicker(false);
  };

  const handleInsertUrl = () => {
    if (!editor || !isSafeUrl(videoUrl)) return;
    const normalized = normalizeVideoEmbedUrl(videoUrl);
    if (!normalized) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'video',
        attrs: {
          src: normalized.src,
          title: videoTitle.trim() || 'Video',
          embedType: normalized.embedType,
        },
      })
      .createParagraphNear()
      .run();
    setVideoUrl('');
    setVideoTitle('');
    setShowUrlDialog(false);
  };

  const videoButton = (
    <>
      <ToolbarButton
        onClick={() => setShowMediaPicker(true)}
        icon={<Play />}
        active={false}
        disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.insertVideo',
          defaultMessage: 'Insert video (Media Library)',
        })}
      />
      <ToolbarButton
        onClick={() => setShowUrlDialog(true)}
        icon={<span style={{ fontSize: '1.1rem', fontWeight: 600 }}>🎬 URL</span>}
        active={false}
        disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.insertVideoUrl',
          defaultMessage: 'Embed video by URL (YouTube, Vimeo, MP4)',
        })}
      />
    </>
  );

  const videoDialog = (
    <>
      <MediaLibraryWrapper
        open={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelectAssets={handleSelectAssets}
        allowedTypes={['videos']}
      />
      <Dialog.Root
        open={showUrlDialog}
        onOpenChange={(v: boolean) => {
          if (!v) setShowUrlDialog(false);
        }}
      >
        {showUrlDialog && (
          <Dialog.Content>
            <Dialog.Header>
              {formatMessage({
                id: 'tiptap-editor.video.dialogHeader',
                defaultMessage: 'Embed Video (YouTube, Vimeo, or Direct Video URL)',
              })}
            </Dialog.Header>
            <Dialog.Body>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <Field.Root width="100%">
                  <Field.Label>
                    {formatMessage({
                      id: 'tiptap-editor.video.urlLabel',
                      defaultMessage: 'Video URL',
                    })}
                  </Field.Label>
                  <TextInput
                    name="video-url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setVideoUrl(e.target.value)
                    }
                  />
                </Field.Root>
                <Field.Root width="100%">
                  <Field.Label>
                    {formatMessage({
                      id: 'tiptap-editor.video.titleLabel',
                      defaultMessage: 'Accessible Title (WCAG)',
                    })}
                  </Field.Label>
                  <TextInput
                    name="video-title"
                    placeholder="Product walkthrough video"
                    value={videoTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setVideoTitle(e.target.value)
                    }
                  />
                </Field.Root>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Cancel>
                <Button variant="tertiary" fullWidth onClick={() => setShowUrlDialog(false)}>
                  {formatMessage({ id: 'tiptap-editor.common.cancel', defaultMessage: 'Cancel' })}
                </Button>
              </Dialog.Cancel>
              <Dialog.Action>
                <Button
                  variant="success-light"
                  fullWidth
                  onClick={handleInsertUrl}
                  disabled={!isSafeUrl(videoUrl)}
                >
                  {formatMessage({ id: 'tiptap-editor.common.insert', defaultMessage: 'Insert' })}
                </Button>
              </Dialog.Action>
            </Dialog.Footer>
          </Dialog.Content>
        )}
      </Dialog.Root>
    </>
  );

  return { videoButton, videoDialog };
}
