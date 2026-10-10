import React from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Check } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';

// ─── 1. Accordion / Collapsible (<details> + <summary>) ─────────────────────

export const DetailsSummaryNode = Node.create({
  name: 'detailsSummary',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes, { class: 'tiptap-details-summary' }), 0];
  },
});

export const DetailsContentNode = Node.create({
  name: 'detailsContent',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="details-content"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'details-content',
        class: 'tiptap-details-content',
      }),
      0,
    ];
  },
});

export const DetailsNode = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el: HTMLElement) => el.hasAttribute('open'),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.open ? { open: 'open' } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'tiptap-details' }), 0];
  },
});

// ─── 2. Edifice IO Conversation History Block ────────────────────────────────

export const ConversationHistoryNode = Node.create({
  name: 'conversationHistory',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      author: { default: null },
      timestamp: { default: null },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="conversation-history"]' },
      { tag: 'blockquote[data-type="conversation-history"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'conversation-history',
        class: 'tiptap-conversation-history',
      }),
      0,
    ];
  },
});

// ─── 3. Hashbite Multi-Column Grid Layout (2-Col / 3-Col) ───────────────────

export const LayoutColumnNode = Node.create({
  name: 'layoutColumn',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="layout-column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'layout-column',
        class: 'tiptap-layout-column',
      }),
      0,
    ];
  },
});

export const LayoutContainerNode = Node.create({
  name: 'layoutContainer',
  group: 'block',
  content: 'layoutColumn+',
  defining: true,

  addAttributes() {
    return {
      columns: {
        default: '1:1',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-columns') ?? '1:1',
        renderHTML: (attrs: Record<string, unknown>) => ({
          'data-columns': String(attrs.columns || '1:1'),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="layout-container"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'layout-container',
        class: 'tiptap-layout-container',
      }),
      0,
    ];
  },
});

// ─── 4. Interactive Task List / Checklist ───────────────────────────────────

export function TaskItemNodeView({ node, updateAttributes }: NodeViewProps) {
  const checked = Boolean(node.attrs.checked);
  return (
    <NodeViewWrapper
      as="li"
      data-type="taskItem"
      data-checked={checked ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        listStyle: 'none',
        margin: '4px 0',
      }}
    >
      <label contentEditable={false} style={{ display: 'flex', alignItems: 'center', marginTop: '3px' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => updateAttributes({ checked: e.target.checked })}
          aria-label="Task item checkbox"
        />
      </label>
      <NodeViewContent style={{ flexGrow: 1 }} />
    </NodeViewWrapper>
  );
}

export const TaskItemNode = Node.create({
  name: 'taskItem',
  content: 'paragraph block*',
  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-checked') === 'true',
        renderHTML: (attrs: Record<string, unknown>) => ({
          'data-checked': attrs.checked ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(HTMLAttributes, { 'data-type': 'taskItem' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TaskItemNodeView);
  },
});

export const TaskListNode = Node.create({
  name: 'taskList',
  group: 'block list',
  content: 'taskItem+',

  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ul',
      mergeAttributes(HTMLAttributes, { 'data-type': 'taskList', class: 'tiptap-task-list' }),
      0,
    ];
  },
});

// ─── 5. Page Break & Live Table of Contents ─────────────────────────────────

export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        class: 'tiptap-page-break',
        role: 'separator',
        'aria-label': 'Page break',
      }),
      '--- Page Break ---',
    ];
  },
});

export function TableOfContentsNodeView({ editor }: NodeViewProps) {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  if (editor?.state?.doc) {
    editor.state.doc.descendants((n) => {
      if (n.type.name === 'heading') {
        const level = Number(n.attrs.level) || 1;
        const text = n.textContent || 'Untitled heading';
        const id =
          n.attrs.id ||
          text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        headings.push({ level, text, id });
      }
    });
  }

  return (
    <NodeViewWrapper data-type="table-of-contents">
      <nav
        aria-label="Table of Contents"
        contentEditable={false}
        style={{
          padding: '12px 16px',
          margin: '0.75em 0',
          backgroundColor: '#f6f6f9',
          border: '1px solid #dcdce4',
          borderRadius: '6px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '6px', color: '#32324d' }}>
          📑 Table of Contents
        </div>
        {headings.length === 0 ? (
          <div style={{ fontSize: '1.2rem', color: '#666687', fontStyle: 'italic' }}>
            Add headings (H1–H6) to populate the Table of Contents automatically.
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '16px', listStyle: 'none' }}>
            {headings.map((h, i) => (
              <li
                key={`${h.id}-${i}`}
                style={{
                  marginLeft: `${(h.level - 1) * 14}px`,
                  fontSize: '1.25rem',
                  padding: '2px 0',
                }}
              >
                <a href={`#${h.id}`} style={{ color: '#4945ff', textDecoration: 'none' }}>
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </NodeViewWrapper>
  );
}

export const TableOfContentsNode = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'nav[data-type="table-of-contents"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'nav',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'table-of-contents',
        'aria-label': 'Table of Contents',
      }),
      'Table of Contents',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsNodeView);
  },
});

export function useStructuredBlocks(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isTaskList: ctx.editor?.isActive('taskList') ?? false,
      isAccordion: ctx.editor?.isActive('details') ?? false,
      isColumns: ctx.editor?.isActive('layoutContainer') ?? false,
      isConversation: ctx.editor?.isActive('conversationHistory') ?? false,
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  const isDisabled = props.disabled || !editor || (editorState?.isInCodeBlock ?? false);

  const insertAccordion = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'details',
        attrs: { open: true },
        content: [
          {
            type: 'detailsSummary',
            content: [{ type: 'text', text: 'Accordion Summary' }],
          },
          {
            type: 'detailsContent',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Collapsible content goes here...' }],
              },
            ],
          },
        ],
      })
      .run();
  };

  const insertColumns = (cols: '1:1' | '1:1:1' = '1:1') => {
    const count = cols === '1:1:1' ? 3 : 2;
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'layoutContainer',
        attrs: { columns: cols },
        content: Array.from({ length: count }, (_, idx) => ({
          type: 'layoutColumn',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `Column ${idx + 1}` }],
            },
          ],
        })),
      })
      .run();
  };

  const insertTaskList = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'To-do item' }] }],
          },
        ],
      })
      .run();
  };

  const insertConversationHistory = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'conversationHistory',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Previous message in thread...' }],
          },
        ],
      })
      .run();
  };

  const insertPageBreak = () => {
    editor?.chain().focus().insertContent({ type: 'pageBreak' }).createParagraphNear().run();
  };

  const insertTableOfContents = () => {
    editor?.chain().focus().insertContent({ type: 'tableOfContents' }).createParagraphNear().run();
  };

  return {
    accordionButton: (
      <ToolbarButton
        onClick={insertAccordion}
        icon={<span style={{ fontSize: '1.1rem', fontWeight: 700 }}>▸ Details</span>}
        active={editorState?.isAccordion ?? false}
        disabled={isDisabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.accordion',
          defaultMessage: 'Insert collapsible accordion (<details>)',
        })}
      />
    ),
    columnsButton: (
      <ToolbarButton
        onClick={() => insertColumns('1:1')}
        icon={<span style={{ fontSize: '1.1rem', fontWeight: 700 }}>▥ 2-Col</span>}
        active={editorState?.isColumns ?? false}
        disabled={isDisabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.columns',
          defaultMessage: 'Insert multi-column layout',
        })}
      />
    ),
    taskListButton: (
      <ToolbarButton
        onClick={insertTaskList}
        icon={<Check />}
        active={editorState?.isTaskList ?? false}
        disabled={isDisabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.taskList',
          defaultMessage: 'Insert interactive checklist',
        })}
      />
    ),
    conversationHistoryButton: (
      <ToolbarButton
        onClick={insertConversationHistory}
        icon={<span style={{ fontSize: '1.1rem', fontWeight: 700 }}>💬 Thread</span>}
        active={editorState?.isConversation ?? false}
        disabled={isDisabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.conversationHistory',
          defaultMessage: 'Insert conversation history block',
        })}
      />
    ),
    pageBreakButton: (
      <ToolbarButton
        onClick={insertPageBreak}
        icon={<span style={{ fontSize: '1.1rem', fontWeight: 700 }}>⎯ Page</span>}
        active={false}
        disabled={isDisabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.pageBreak',
          defaultMessage: 'Insert page break',
        })}
      />
    ),
    tableOfContentsButton: (
      <ToolbarButton
        onClick={insertTableOfContents}
        icon={<span style={{ fontSize: '1.1rem', fontWeight: 700 }}>📑 TOC</span>}
        active={false}
        disabled={isDisabled}
        tooltip={formatMessage({
          id: 'tiptap-editor.toolbar.tableOfContents',
          defaultMessage: 'Insert Table of Contents',
        })}
      />
    ),
  };
}
