import React from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Button } from '@strapi/design-system';
import { Information } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';

export type InfoPaneVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'tip';

export interface InformationPaneOptions {
  enableContentCheck: boolean;
  HTMLAttributes: Record<string, unknown>;
}

const VARIANT_STYLES: Record<
  InfoPaneVariant,
  { bg: string; border: string; text: string; icon: string; label: string }
> = {
  info: {
    bg: '#eaf5ff',
    border: '#66b7f1',
    text: '#006096',
    icon: 'ℹ️',
    label: 'Info',
  },
  warning: {
    bg: '#fdf4dc',
    border: '#f29d41',
    text: '#be5d01',
    icon: '⚠️',
    label: 'Warning',
  },
  success: {
    bg: '#eafbe7',
    border: '#5cb176',
    text: '#2f6846',
    icon: '✅',
    label: 'Success',
  },
  danger: {
    bg: '#fcecea',
    border: '#ee5e52',
    text: '#b72b1a',
    icon: '🚨',
    label: 'Danger',
  },
  neutral: {
    bg: '#f6f6f9',
    border: '#c0c0cf',
    text: '#32324d',
    icon: '📌',
    label: 'Note',
  },
  tip: {
    bg: '#f0f0ff',
    border: '#7b79ff',
    text: '#271fe0',
    icon: '💡',
    label: 'Tip',
  },
};

export function InformationPaneNodeViewReadOnly({ node }: NodeViewProps) {
  const variant = ((node.attrs.variant as InfoPaneVariant) || 'info') in VARIANT_STYLES
    ? (node.attrs.variant as InfoPaneVariant)
    : 'info';
  const style = VARIANT_STYLES[variant];

  return (
    <NodeViewWrapper data-type="information-pane" data-variant={variant}>
      <aside
        role="note"
        aria-label={`${style.label} callout`}
        style={{
          margin: '0.75em 0',
          padding: '12px 16px',
          backgroundColor: style.bg,
          borderLeft: `4px solid ${style.border}`,
          borderRadius: '6px',
          color: style.text,
        }}
      >
        <div
          contentEditable={false}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            fontSize: '1.25rem',
            marginBottom: '6px',
          }}
        >
          <span>{style.icon}</span>
          <span>{node.attrs.title || style.label}</span>
        </div>
        <NodeViewContent className="information-pane-content" />
      </aside>
    </NodeViewWrapper>
  );
}

export function InformationPaneNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const variant = ((node.attrs.variant as InfoPaneVariant) || 'info') in VARIANT_STYLES
    ? (node.attrs.variant as InfoPaneVariant)
    : 'info';
  const style = VARIANT_STYLES[variant];

  return (
    <NodeViewWrapper data-type="information-pane" data-variant={variant}>
      <aside
        role="note"
        aria-label={`${style.label} callout`}
        style={{
          margin: '0.75em 0',
          padding: '12px 16px',
          backgroundColor: style.bg,
          borderLeft: `4px solid ${style.border}`,
          borderRadius: '6px',
          color: style.text,
          outline: selected ? '2px solid #4945ff' : undefined,
        }}
      >
        <div
          contentEditable={false}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
            <span>{style.icon}</span>
            <span>{style.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(Object.keys(VARIANT_STYLES) as InfoPaneVariant[]).map((v) => (
              <Button
                key={v}
                size="S"
                variant={v === variant ? 'secondary' : 'tertiary'}
                onClick={() => updateAttributes({ variant: v })}
              >
                {VARIANT_STYLES[v].icon}
              </Button>
            ))}
            <Button size="S" variant="danger-light" onClick={deleteNode}>
              ×
            </Button>
          </div>
        </div>
        <NodeViewContent className="information-pane-content" />
      </aside>
    </NodeViewWrapper>
  );
}

export const InformationPane = Node.create<InformationPaneOptions>({
  name: 'informationPane',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      enableContentCheck: false,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-variant') ?? 'info',
        renderHTML: (attrs: Record<string, unknown>) => ({
          'data-variant': String(attrs.variant || 'info'),
        }),
      },
      title: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-title') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.title ? { 'data-title': String(attrs.title) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="information-pane"]' }, { tag: 'div[data-type="alert"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'information-pane',
        role: 'note',
      }),
      0,
    ];
  },

  addNodeView() {
    if (this.options.enableContentCheck) {
      return ReactNodeViewRenderer(InformationPaneNodeViewReadOnly);
    }
    return ReactNodeViewRenderer(InformationPaneNodeView);
  },
});

export function useInformationPane(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isActive: ctx.editor?.isActive('informationPane') ?? false,
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  const handleInsert = () => {
    if (!editor) return;
    if (editor.isActive('informationPane')) {
      editor.chain().focus().lift('informationPane').run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'informationPane',
          attrs: { variant: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important information...' }] }],
        })
        .run();
    }
  };

  return {
    informationPaneButton: (
      <ToolbarButton
        onClick={handleInsert}
        icon={<Information />}
        active={editorState?.isActive ?? false}
        disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.informationPane',
          defaultMessage: 'Insert Information Pane / Alert Callout',
        })}
      />
    ),
  };
}
