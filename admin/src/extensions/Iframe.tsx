import React, { useState } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Button, Dialog, Field, IconButton, Popover, TextInput } from '@strapi/design-system';
import { Earth, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';
import { isSafeIframeUrl } from '../../../shared/contentSerializer';

export interface StrapiIframeOptions {
  enableContentCheck: boolean;
  allowedDomains?: string[];
  allowFullscreen?: boolean;
  HTMLAttributes: Record<string, unknown>;
}

export function IframeNodeViewReadOnly({ node, extension }: NodeViewProps) {
  const { src, title, width, height } = node.attrs;
  const align = node.attrs['data-align'] ?? undefined;
  const allowedDomains = (extension?.options as StrapiIframeOptions | undefined)?.allowedDomains;
  const safe = isSafeIframeUrl(src, allowedDomains);

  return (
    <NodeViewWrapper data-drag-handle data-align={align} data-type="iframe">
      {safe ? (
        <iframe
          src={src}
          title={title || 'Embedded content'}
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
          style={{
            width: width ? `${width}px` : '100%',
            height: height ? `${height}px` : '380px',
            border: '1px solid #dcdce4',
            borderRadius: '6px',
            display: 'block',
          }}
        />
      ) : (
        <div
          role="alert"
          style={{
            padding: '12px',
            backgroundColor: '#fcecea',
            color: '#b72b1a',
            borderRadius: '6px',
            border: '1px solid #f5c0b8',
            fontSize: '1.3rem',
          }}
        >
          Blocked unsafe or untrusted iframe URL: {String(src || '')}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export function IframeNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const { formatMessage } = useIntl();
  const [openPopover, setOpenPopover] = useState(false);
  const [title, setTitle] = useState<string>(node.attrs.title ?? '');

  return (
    <NodeViewWrapper
      data-drag-handle
      data-align={node.attrs['data-align'] ?? undefined}
      data-type="iframe"
    >
      <Popover.Root open={openPopover} onOpenChange={setOpenPopover}>
        <Popover.Anchor>
          <div
            onClick={() => setOpenPopover(true)}
            style={{
              outline: selected ? '2px solid #4945ff' : undefined,
              borderRadius: '6px',
              cursor: 'pointer',
              margin: '0.75em 0',
            }}
          >
            <IframeNodeViewReadOnly {...props} />
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
                id: 'tiptap-editor.iframe.title',
                defaultMessage: 'Iframe accessible title',
              })}
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              onBlur={() => updateAttributes({ title: title || 'Embedded content' })}
              aria-label={formatMessage({
                id: 'tiptap-editor.iframe.title',
                defaultMessage: 'Iframe accessible title',
              })}
            />
            <IconButton
              onClick={deleteNode}
              label={formatMessage({
                id: 'tiptap-editor.iframe.delete',
                defaultMessage: 'Delete embed',
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

export const StrapiIframe = Node.create<StrapiIframeOptions>({
  name: 'iframe',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      enableContentCheck: false,
      allowedDomains: [],
      allowFullscreen: true,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      title: { default: 'Embedded content' },
      width: { default: null },
      height: { default: 380 },
      'data-align': {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['data-align'] ? { 'data-align': String(attrs['data-align']) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'iframe',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        sandbox: 'allow-scripts allow-same-origin allow-popups',
        loading: 'lazy',
      }),
    ];
  },

  addNodeView() {
    if (this.options.enableContentCheck) {
      return ReactNodeViewRenderer(IframeNodeViewReadOnly);
    }
    return ReactNodeViewRenderer(IframeNodeView);
  },
});

export function useIframe(
  editor: Editor | null,
  props: { disabled?: boolean; allowedDomains?: string[] } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [height, setHeight] = useState('380');

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  const isValid = isSafeIframeUrl(url, props.allowedDomains);

  const handleInsert = () => {
    if (!editor || !isValid) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'iframe',
        attrs: {
          src: url.trim(),
          title: title.trim() || 'Embedded content',
          height: parseInt(height, 10) || 380,
        },
      })
      .createParagraphNear()
      .run();
    setUrl('');
    setTitle('');
    setOpen(false);
  };

  const iframeButton = (
    <ToolbarButton
      onClick={() => setOpen(true)}
      icon={<Earth />}
      active={false}
      disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.insertIframe',
        defaultMessage: 'Insert iframe embed (HTTPS)',
      })}
    />
  );

  const iframeDialog = (
    <Dialog.Root
      open={open}
      onOpenChange={(v: boolean) => {
        if (!v) setOpen(false);
      }}
    >
      {open && (
        <Dialog.Content>
          <Dialog.Header>
            {formatMessage({
              id: 'tiptap-editor.iframe.dialogHeader',
              defaultMessage: 'Insert Sandboxed HTTPS Embed (Iframe)',
            })}
          </Dialog.Header>
          <Dialog.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <Field.Root width="100%">
                <Field.Label>
                  {formatMessage({
                    id: 'tiptap-editor.iframe.urlLabel',
                    defaultMessage: 'HTTPS Embed URL',
                  })}
                </Field.Label>
                <TextInput
                  name="iframe-url"
                  placeholder="https://www.figma.com/embed?..."
                  value={url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                />
              </Field.Root>
              <Field.Root width="100%">
                <Field.Label>
                  {formatMessage({
                    id: 'tiptap-editor.iframe.titleLabel',
                    defaultMessage: 'Accessible Frame Title (Required for WCAG)',
                  })}
                </Field.Label>
                <TextInput
                  name="iframe-title"
                  placeholder="Interactive prototype embed"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                />
              </Field.Root>
              <Field.Root width="100%">
                <Field.Label>
                  {formatMessage({
                    id: 'tiptap-editor.iframe.heightLabel',
                    defaultMessage: 'Height (px)',
                  })}
                </Field.Label>
                <TextInput
                  name="iframe-height"
                  type="number"
                  value={height}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHeight(e.target.value)}
                />
              </Field.Root>
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary" fullWidth onClick={() => setOpen(false)}>
                {formatMessage({ id: 'tiptap-editor.common.cancel', defaultMessage: 'Cancel' })}
              </Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="success-light" fullWidth onClick={handleInsert} disabled={!isValid}>
                {formatMessage({ id: 'tiptap-editor.common.insert', defaultMessage: 'Insert' })}
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      )}
    </Dialog.Root>
  );

  return { iframeButton, iframeDialog };
}
