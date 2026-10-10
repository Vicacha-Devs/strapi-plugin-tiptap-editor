import React, { useState, useRef, useEffect } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Button, Dialog, Field, IconButton, Popover, TextInput } from '@strapi/design-system';
import { Microphone, Trash, VolumeUp } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';
import { MediaLibraryWrapper, type StrapiFile } from '../components/MediaLibraryWrapper';
import { isSafeUrl } from '../../../shared/contentSerializer';

export interface StrapiAudioOptions {
  enableContentCheck: boolean;
  HTMLAttributes: Record<string, unknown>;
}

export function AudioNodeViewReadOnly({ node }: NodeViewProps) {
  const { src, title, caption } = node.attrs;
  const align = node.attrs['data-align'] ?? undefined;
  const safeSrc = isSafeUrl(src) || (typeof src === 'string' && src.startsWith('data:audio/')) ? src : '';

  return (
    <NodeViewWrapper data-drag-handle data-align={align} data-type="audio">
      <figure
        style={{
          margin: '0.75em 0',
          padding: '10px 14px',
          backgroundColor: '#f6f6f9',
          borderRadius: '8px',
          border: '1px solid #dcdce4',
        }}
      >
        {title && (
          <div style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '6px', color: '#32324d' }}>
            🎧 {title}
          </div>
        )}
        <audio
          src={safeSrc}
          controls
          preload="metadata"
          aria-label={title || 'Audio player'}
          style={{ width: '100%', display: 'block' }}
        />
        {caption && (
          <figcaption style={{ fontSize: '1.2rem', color: '#666687', marginTop: '6px' }}>
            {caption}
          </figcaption>
        )}
      </figure>
    </NodeViewWrapper>
  );
}

export function AudioNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const { formatMessage } = useIntl();
  const [openPopover, setOpenPopover] = useState(false);
  const [title, setTitle] = useState<string>(node.attrs.title ?? '');
  const [caption, setCaption] = useState<string>(node.attrs.caption ?? '');

  return (
    <NodeViewWrapper
      data-drag-handle
      data-align={node.attrs['data-align'] ?? undefined}
      data-type="audio"
    >
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
            <AudioNodeViewReadOnly {...props} />
          </div>
        </Popover.Anchor>
        <Popover.Content side="bottom">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '10px',
              minWidth: '240px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Audio Settings</span>
              <IconButton
                onClick={deleteNode}
                label={formatMessage({
                  id: 'tiptap-editor.audio.delete',
                  defaultMessage: 'Delete audio',
                })}
              >
                <Trash />
              </IconButton>
            </div>
            <TextInput
              placeholder={formatMessage({
                id: 'tiptap-editor.audio.title',
                defaultMessage: 'Audio title',
              })}
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              onBlur={() => updateAttributes({ title: title || null })}
              aria-label={formatMessage({
                id: 'tiptap-editor.audio.title',
                defaultMessage: 'Audio title',
              })}
            />
            <TextInput
              placeholder={formatMessage({
                id: 'tiptap-editor.audio.caption',
                defaultMessage: 'Audio caption',
              })}
              value={caption}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaption(e.target.value)}
              onBlur={() => updateAttributes({ caption: caption || null })}
              aria-label={formatMessage({
                id: 'tiptap-editor.audio.caption',
                defaultMessage: 'Audio caption',
              })}
            />
          </div>
        </Popover.Content>
      </Popover.Root>
    </NodeViewWrapper>
  );
}

export const StrapiAudio = Node.create<StrapiAudioOptions>({
  name: 'audio',
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
      mime: { default: null },
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
    return [{ tag: 'audio[src]' }, { tag: 'div[data-type="audio"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'audio',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { controls: 'true' }),
    ];
  },

  addNodeView() {
    if (this.options.enableContentCheck) {
      return ReactNodeViewRenderer(AudioNodeViewReadOnly);
    }
    return ReactNodeViewRenderer(AudioNodeView);
  },
});

export function useAudio(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [showPicker, setShowPicker] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedDataUrl, setRecordedDataUrl] = useState<string | null>(null);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSelectAssets = (assets: StrapiFile[]) => {
    const asset = assets[0];
    const src = asset?.url?.trim();
    if (!asset || !editor || !src) {
      setShowPicker(false);
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: 'audio',
        attrs: {
          src,
          title: asset.alternativeText ?? asset.name ?? 'Audio',
          caption: asset.caption ?? null,
          mime: asset.mime ?? null,
          'data-asset-id': asset.id,
          'data-document-id': asset.documentId ?? null,
        },
      })
      .createParagraphNear()
      .run();

    setShowPicker(false);
  };

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setRecordedDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleInsertRecording = () => {
    if (!editor || !recordedDataUrl) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'audio',
        attrs: {
          src: recordedDataUrl,
          title: recordTitle.trim() || 'Voice Recording',
          mime: 'audio/webm',
        },
      })
      .createParagraphNear()
      .run();
    setRecordedDataUrl(null);
    setRecordTitle('');
    setShowRecorder(false);
  };

  const audioButton = (
    <>
      <ToolbarButton
        onClick={() => setShowPicker(true)}
        icon={<VolumeUp />}
        active={false}
        disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.insertAudio',
          defaultMessage: 'Insert audio (Media Library)',
        })}
      />
      <ToolbarButton
        onClick={() => setShowRecorder(true)}
        icon={<Microphone />}
        active={isRecording}
        disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.recordAudio',
          defaultMessage: 'Record audio clip',
        })}
      />
    </>
  );

  const audioDialog = (
    <>
      <MediaLibraryWrapper
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectAssets={handleSelectAssets}
        allowedTypes={['audios']}
      />
      <Dialog.Root
        open={showRecorder}
        onOpenChange={(v: boolean) => {
          if (!v) {
            stopRecording();
            setShowRecorder(false);
          }
        }}
      >
        {showRecorder && (
          <Dialog.Content>
            <Dialog.Header>
              {formatMessage({
                id: 'tiptap-editor.audio.recorderTitle',
                defaultMessage: 'Record Audio Clip',
              })}
            </Dialog.Header>
            <Dialog.Body>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <Field.Root width="100%">
                  <Field.Label>
                    {formatMessage({
                      id: 'tiptap-editor.audio.titleLabel',
                      defaultMessage: 'Audio Clip Title',
                    })}
                  </Field.Label>
                  <TextInput
                    name="audio-title"
                    placeholder="Voice note"
                    value={recordTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRecordTitle(e.target.value)
                    }
                  />
                </Field.Root>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {!isRecording ? (
                    <Button variant="secondary" onClick={startRecording}>
                      ● Start Recording
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={stopRecording}>
                      ■ Stop ({recordSeconds}s)
                    </Button>
                  )}
                  <span aria-live="polite" style={{ fontSize: '1.3rem', color: '#666687' }}>
                    {isRecording ? `Recording... ${recordSeconds}s` : 'Ready'}
                  </span>
                </div>
                {recordedDataUrl && (
                  <audio
                    src={recordedDataUrl}
                    controls
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                )}
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Cancel>
                <Button
                  variant="tertiary"
                  fullWidth
                  onClick={() => {
                    stopRecording();
                    setShowRecorder(false);
                  }}
                >
                  {formatMessage({ id: 'tiptap-editor.common.cancel', defaultMessage: 'Cancel' })}
                </Button>
              </Dialog.Cancel>
              <Dialog.Action>
                <Button
                  variant="success-light"
                  fullWidth
                  onClick={handleInsertRecording}
                  disabled={!recordedDataUrl}
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

  return { audioButton, audioDialog };
}
