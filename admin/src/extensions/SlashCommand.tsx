import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Popover, TextInput } from '@strapi/design-system';
import { Plus } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';
import { isFeatureEnabled, type TiptapPresetConfig } from '../../../shared/types';
import {
  getRegisteredTiptapExtensions,
  isCustomExtensionEnabledForPreset,
} from '../utils/customExtensionRegistry';

export type SlashCommandTranslator = (
  id: string,
  defaultMessage: string,
  values?: Record<string, string | number>
) => string;

export interface SlashCommandItem {
  id: string;
  featureKey: keyof TiptapPresetConfig;
  label: string;
  description: string;
  keywords: string[];
  isAvailable?: (editor: Editor) => boolean;
  action: (editor: Editor, t: SlashCommandTranslator) => void;
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: 'h1',
    featureKey: 'heading',
    label: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'heading', 'title'],
    isAvailable: (ed) => typeof (ed.commands as Record<string, unknown>)?.setHeading === 'function',
    action: (ed) => ed.chain().focus().setHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    featureKey: 'heading',
    label: 'Heading 2',
    description: 'Primary section heading',
    keywords: ['h2', 'heading', 'subtitle'],
    isAvailable: (ed) => typeof (ed.commands as Record<string, unknown>)?.setHeading === 'function',
    action: (ed) => ed.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    featureKey: 'heading',
    label: 'Heading 3',
    description: 'Medium subsection heading',
    keywords: ['h3', 'heading'],
    isAvailable: (ed) => typeof (ed.commands as Record<string, unknown>)?.setHeading === 'function',
    action: (ed) => ed.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: 'h4',
    featureKey: 'heading',
    label: 'Heading 4',
    description: 'Small subsection heading',
    keywords: ['h4', 'heading'],
    isAvailable: (ed) => typeof (ed.commands as Record<string, unknown>)?.setHeading === 'function',
    action: (ed) => ed.chain().focus().setHeading({ level: 4 }).run(),
  },
  {
    id: 'infoPane',
    featureKey: 'informationPane',
    label: 'Information Pane / Callout',
    description: 'Highlighted callout box (Info, Warning, Success, Danger)',
    keywords: ['info', 'alert', 'callout', 'warning', 'pane'],
    action: (ed, t) =>
      ed
        .chain()
        .focus()
        .insertContent({
          type: 'informationPane',
          attrs: { variant: 'info' },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: t('tiptap-editor.infoPane.defaultContent', 'Enter callout details here...'),
                },
              ],
            },
          ],
        })
        .run(),
  },
  {
    id: 'taskList',
    featureKey: 'taskList',
    label: 'Checklist / Task List',
    description: 'Interactive to-do list with checkboxes',
    keywords: ['task', 'todo', 'checklist', 'check'],
    action: (ed, t) =>
      ed
        .chain()
        .focus()
        .insertContent({
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t('tiptap-editor.structured.taskItemDefault', 'To-do item'),
                    },
                  ],
                },
              ],
            },
          ],
        })
        .run(),
  },
  {
    id: 'accordion',
    featureKey: 'accordion',
    label: 'Accordion (<details>)',
    description: 'Collapsible details and summary block',
    keywords: ['accordion', 'details', 'collapse', 'faq'],
    action: (ed, t) =>
      ed
        .chain()
        .focus()
        .insertContent({
          type: 'details',
          attrs: { open: true },
          content: [
            {
              type: 'detailsSummary',
              content: [
                {
                  type: 'text',
                  text: t('tiptap-editor.structured.accordionSummaryDefault', 'Accordion Summary'),
                },
              ],
            },
            {
              type: 'detailsContent',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t(
                        'tiptap-editor.structured.accordionContentDefault',
                        'Collapsible content goes here...'
                      ),
                    },
                  ],
                },
              ],
            },
          ],
        })
        .run(),
  },
  {
    id: 'columns2',
    featureKey: 'columns',
    label: '2-Column Layout',
    description: 'Side-by-side responsive 2-column grid',
    keywords: ['columns', 'grid', 'layout', '2'],
    action: (ed, t) =>
      ed
        .chain()
        .focus()
        .insertContent({
          type: 'layoutContainer',
          attrs: { columns: '1:1' },
          content: [
            {
              type: 'layoutColumn',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t('tiptap-editor.structured.columnDefault', 'Column {index}', {
                        index: 1,
                      }),
                    },
                  ],
                },
              ],
            },
            {
              type: 'layoutColumn',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t('tiptap-editor.structured.columnDefault', 'Column {index}', {
                        index: 2,
                      }),
                    },
                  ],
                },
              ],
            },
          ],
        })
        .run(),
  },
  {
    id: 'columns3',
    featureKey: 'columns',
    label: '3-Column Layout',
    description: 'Equal 3-column responsive grid',
    keywords: ['columns', 'grid', 'layout', '3'],
    action: (ed, t) =>
      ed
        .chain()
        .focus()
        .insertContent({
          type: 'layoutContainer',
          attrs: { columns: '1:1:1' },
          content: [
            {
              type: 'layoutColumn',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t('tiptap-editor.structured.columnDefault', 'Column {index}', {
                        index: 1,
                      }),
                    },
                  ],
                },
              ],
            },
            {
              type: 'layoutColumn',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t('tiptap-editor.structured.columnDefault', 'Column {index}', {
                        index: 2,
                      }),
                    },
                  ],
                },
              ],
            },
            {
              type: 'layoutColumn',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: t('tiptap-editor.structured.columnDefault', 'Column {index}', {
                        index: 3,
                      }),
                    },
                  ],
                },
              ],
            },
          ],
        })
        .run(),
  },
  {
    id: 'codeBlock',
    featureKey: 'codeBlock',
    label: 'Code Block',
    description: 'Preformatted code block',
    keywords: ['code', 'snippet', 'pre'],
    isAvailable: (ed) =>
      typeof (ed.commands as Record<string, unknown>)?.toggleCodeBlock === 'function',
    action: (ed) => ed.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'blockquote',
    featureKey: 'blockquote',
    label: 'Blockquote',
    description: 'Quoted text passage',
    keywords: ['quote', 'blockquote'],
    isAvailable: (ed) =>
      typeof (ed.commands as Record<string, unknown>)?.toggleBlockquote === 'function',
    action: (ed) => ed.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'table',
    featureKey: 'table',
    label: 'Table (3×3)',
    description: 'Insert a 3×3 table with header row',
    keywords: ['table', 'grid'],
    isAvailable: (ed) =>
      typeof (ed.commands as Record<string, unknown>)?.insertTable === 'function',
    action: (ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'toc',
    featureKey: 'tableOfContents',
    label: 'Table of Contents',
    description: 'Auto-generated outline from document headings',
    keywords: ['toc', 'outline', 'contents'],
    action: (ed) =>
      ed.chain().focus().insertContent({ type: 'tableOfContents' }).createParagraphNear().run(),
  },
  {
    id: 'pageBreak',
    featureKey: 'pageBreak',
    label: 'Page Break',
    description: 'Print / pagination break marker',
    keywords: ['page', 'break', 'divider'],
    action: (ed) =>
      ed.chain().focus().insertContent({ type: 'pageBreak' }).createParagraphNear().run(),
  },
  {
    id: 'hr',
    featureKey: 'horizontalRule',
    label: 'Horizontal Rule',
    description: 'Visual horizontal divider line',
    keywords: ['hr', 'line', 'divider'],
    isAvailable: (ed) =>
      typeof (ed.commands as Record<string, unknown>)?.setHorizontalRule === 'function',
    action: (ed) => ed.chain().focus().setHorizontalRule().run(),
  },
];

/**
 * React hook providing the quick-insert slash command popover menu and toolbar button.
 */
export function useSlashCommand(
  editor: Editor | null,
  props: {
    disabled?: boolean;
    config?: TiptapPresetConfig;
    onOpenCustomDialog?: (extensionId: string) => void;
  } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const builtInItems = SLASH_COMMAND_ITEMS.map((item) => ({
    ...item,
    isCustom: false,
    openExtensionDialogId: undefined as string | undefined,
    customAction: undefined as
      | ((
          ed: Editor,
          fmt: (descriptor: { id: string; defaultMessage: string }) => string,
          helpers?: { openDialog: (extId?: string) => void }
        ) => void)
      | undefined,
    label: formatMessage({
      id: `tiptap-editor.slash.${item.id}.label`,
      defaultMessage: item.label.replace(/<([^>]+)>/g, "'<$1>'"),
    }),
    description: formatMessage({
      id: `tiptap-editor.slash.${item.id}.description`,
      defaultMessage: item.description,
    }),
  }));

  const customItems = getRegisteredTiptapExtensions().flatMap((ext) => {
    if (props.config && !isCustomExtensionEnabledForPreset(ext, props.config)) {
      return [];
    }
    return (ext.slashCommands ?? []).map((cmd) => ({
      id: cmd.id,
      featureKey: (ext.featureKey || ext.id) as keyof TiptapPresetConfig,
      isCustom: true,
      openExtensionDialogId: cmd.openExtensionDialogId,
      customAction: cmd.action,
      label: formatMessage({
        id: cmd.labelId || `tiptap-editor.slash.${cmd.id}.label`,
        defaultMessage: cmd.defaultLabel,
      }),
      description: formatMessage({
        id: cmd.descriptionId || `tiptap-editor.slash.${cmd.id}.description`,
        defaultMessage: cmd.defaultDescription,
      }),
      keywords: cmd.keywords,
      isAvailable: cmd.isAvailable,
      action: () => undefined,
    }));
  });

  const localizedItems = [...builtInItems, ...customItems];

  const filteredItems = localizedItems.filter((item) => {
    if (!item.isCustom && props.config && !isFeatureEnabled(props.config[item.featureKey])) {
      return false;
    }
    if (editor && item.isAvailable && !item.isAvailable(editor)) return false;
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

  const handleSelect = (item: (typeof localizedItems)[number]) => {
    if (!editor) return;
    if (!item.isCustom && props.config && !isFeatureEnabled(props.config[item.featureKey])) return;
    if (item.isAvailable && !item.isAvailable(editor)) return;
    if (item.isCustom) {
      if (item.customAction) {
        item.customAction(
          editor,
          (descriptor) => formatMessage(descriptor),
          {
            openDialog: (extId?: string) => {
              const targetId = extId || item.openExtensionDialogId;
              if (targetId) props.onOpenCustomDialog?.(targetId);
            },
          }
        );
      } else if (item.openExtensionDialogId) {
        props.onOpenCustomDialog?.(item.openExtensionDialogId);
      }
    } else {
      item.action(editor, (id, defaultMessage, values) =>
        formatMessage({ id, defaultMessage }, values)
      );
    }
    setOpen(false);
    setFilter('');
  };

  const tooltipLabel = formatMessage({
    id: 'tiptap-editor.toolbar.slashCommands',
    defaultMessage: 'Quick Insert Block (/ Slash Menu)',
  });

  const triggerButton = (
    <ToolbarButton
      onClick={() => undefined}
      icon={<Plus />}
      active={open}
      disabled={!editor || props.disabled}
      tooltip={tooltipLabel}
    />
  );

  return {
    slashCommandTrigger: triggerButton,
    slashCommandButton: (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger>{triggerButton}</Popover.Trigger>
        <Popover.Content side="bottom">
          <div style={{ padding: '10px', width: '280px' }}>
            <TextInput
              placeholder={formatMessage({
                id: 'tiptap-editor.slash.filterPlaceholder',
                defaultMessage: 'Filter blocks (e.g. callout, columns, toc)...',
              })}
              value={filter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
              aria-label={formatMessage({
                id: 'tiptap-editor.slash.filterAria',
                defaultMessage: 'Filter blocks',
              })}
            />
            <div
              role="group"
              aria-label={formatMessage({
                id: 'tiptap-editor.slash.listAria',
                defaultMessage: 'Quick insert blocks',
              })}
              style={{
                maxHeight: '240px',
                overflowY: 'auto',
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                >
                  <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#32324d' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '1.1rem', color: '#666687' }}>{item.description}</div>
                </button>
              ))}
            </div>
          </div>
        </Popover.Content>
      </Popover.Root>
    ),
  };
}
