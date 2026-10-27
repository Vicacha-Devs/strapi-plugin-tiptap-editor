import React, { useState } from 'react';
import { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useEditorState } from '@tiptap/react';
import Heading from '@tiptap/extension-heading';
import { Box, Flex, Popover, SingleSelect, SingleSelectOption, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';

/**
 * Generates a URL-safe slug identifier from heading text for anchor links and Table of Contents.
 */
export function slugifyHeadingText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const headingIdPluginKey = new PluginKey('headingAutoId');

// Base extension class (un-configured) — used by buildExtensions for dynamic levels
export const BaseHeadingWithSEOTag = Heading.extend({
  addOptions() {
    return {
      ...(typeof (this as any).parent === 'function' ? (this as any).parent() : {}),
      autoSlugId: true,
    };
  },

  addAttributes() {
    return {
      ...(typeof (this as any).parent === 'function' ? (this as any).parent() : {}), // must cast to any to avoid TS error
      tag: { default: null },
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('id') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.id ? { id: String(attrs.id) } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins =
      typeof (this as any).parent === 'function' ? ((this as any).parent() ?? []) : [];
    if (!(this.options as { autoSlugId?: boolean }).autoSlugId) {
      return parentPlugins;
    }
    return [
      ...parentPlugins,
      new Plugin({
        key: headingIdPluginKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          let modified = false;
          const slugCounts = new Map<string, number>();
          const usedSlugs = new Set<string>();

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'heading') {
              const baseSlug = slugifyHeadingText(node.textContent);
              let nextId: string | null = null;
              if (baseSlug) {
                const count = (slugCounts.get(baseSlug) ?? 0) + 1;
                slugCounts.set(baseSlug, count);
                if (count === 1 && !usedSlugs.has(baseSlug)) {
                  nextId = baseSlug;
                } else {
                  let suffix = Math.max(2, count);
                  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
                    suffix += 1;
                  }
                  nextId = `${baseSlug}-${suffix}`;
                }
                usedSlugs.add(nextId);
              }
              if (node.attrs.id !== nextId) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: nextId });
                modified = true;
              }
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

// Pre-configured instance with all heading levels
export const HeadingWithSEOTag = BaseHeadingWithSEOTag.configure({ levels: [1, 2, 3, 4, 5, 6] });

/**
 * React hook providing the heading style and SEO tag selector dropdowns for the toolbar.
 */
export function useHeading(
  editor: Editor | null,
  props: { disabled?: boolean; levels?: number[] } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const levels = props.levels ?? [1, 2, 3, 4, 5, 6];
  const seoTagLevels = [1, 2, 3, 4, 5, 6];
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return { headingLevel: undefined, headingTag: undefined, isParagraph: false };
      }
      return {
        headingLevel: ctx.editor.getAttributes('heading').level as number | undefined,
        headingTag: ctx.editor.getAttributes('heading').tag as string | undefined,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
      };
    },
  });

  const onChangeHeading = (value: string) => {
    if (!editor) return;

    if (value === 'p') {
      editor.chain().focus().setParagraph().run();
      setOpen(false);
      return;
    }

    const parsed = Number(value.slice(1));
    if (isNaN(parsed) || parsed < 1 || parsed > 6) return;
    const level = parsed as 1 | 2 | 3 | 4 | 5 | 6;
    editor.chain().focus().setHeading({ level }).run();

    // automatically set the 'tag' attribute to match the heading level if not already set
    if (!editorState?.headingTag) {
      editor
        .chain()
        .focus()
        .updateAttributes('heading', { tag: `h${level}` })
        .run();
    }
    setOpen(false);
  };

  const onChangeHeadingTag = (value: string) => {
    if (!editor) return;
    if (!editorState?.headingLevel) return;
    editor.chain().focus().updateAttributes('heading', { tag: value }).run();
  };

  const currentHeadingLabel = editorState?.headingLevel ? `H${editorState.headingLevel}` : 'T';
  const isDisabled = !editor || Boolean(props.disabled);
  const textStyleLabel = formatMessage({
    id: 'tiptap-editor.heading.textStyle',
    defaultMessage: 'Text style',
  });

  const renderTriggerButton = () => (
    <button
      type="button"
      disabled={isDisabled}
      aria-label={textStyleLabel}
      title={textStyleLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        height: '32px',
        padding: '0 8px',
        borderRadius: '4px',
        border: '1px solid transparent',
        background: open || editorState?.headingLevel ? 'rgba(73, 69, 255, 0.1)' : 'transparent',
        color: editorState?.headingLevel ? '#4945ff' : 'inherit',
        fontFamily: 'Georgia, Cambria, serif',
        fontWeight: 700,
        fontSize: '1.35rem',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <span>{currentHeadingLabel}</span>
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

  return {
    headingTrigger: renderTriggerButton(),
    headingSelect: (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger>{renderTriggerButton()}</Popover.Trigger>
        <Popover.Content side="bottom" align="start" sideOffset={4}>
          <Box padding={2} style={{ minWidth: '190px' }}>
            <Flex direction="column" alignItems="stretch" gap={1}>
              <button
                type="button"
                onClick={() => onChangeHeading('p')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: !editorState?.headingLevel ? 'rgba(73, 69, 255, 0.1)' : 'transparent',
                  color: !editorState?.headingLevel ? '#4945ff' : 'inherit',
                  fontSize: '1.3rem',
                  fontWeight: !editorState?.headingLevel ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>
                  {formatMessage({
                    id: 'tiptap-editor.heading.paragraph',
                    defaultMessage: 'Paragraph',
                  })}
                </span>
                <span style={{ fontSize: '1.1rem', opacity: 0.6 }}>p</span>
              </button>
              {levels.map((level) => {
                const isActive = editorState?.headingLevel === level;
                return (
                  <button
                    key={`h${level}`}
                    type="button"
                    onClick={() => onChangeHeading(`h${level}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 10px',
                      border: 'none',
                      borderRadius: '4px',
                      background: isActive ? 'rgba(73, 69, 255, 0.1)' : 'transparent',
                      color: isActive ? '#4945ff' : 'inherit',
                      fontSize: `${Math.max(1.25, 1.85 - level * 0.12)}rem`,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>
                      {formatMessage(
                        { id: 'tiptap-editor.heading.heading', defaultMessage: 'Heading {level}' },
                        { level }
                      )}
                    </span>
                    <span style={{ fontSize: '1.1rem', opacity: 0.6 }}>{`h${level}`}</span>
                  </button>
                );
              })}

              <Box
                paddingTop={2}
                marginTop={1}
                style={{ borderTop: '1px solid rgba(128, 128, 128, 0.2)' }}
              >
                <Box paddingBottom={1}>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({
                      id: 'tiptap-editor.heading.seoTag',
                      defaultMessage: 'SEO Tag Override',
                    })}
                  </Typography>
                </Box>
                <SingleSelect
                  placeholder={formatMessage({
                    id: 'tiptap-editor.heading.seoTag',
                    defaultMessage: 'SEO Tag',
                  })}
                  aria-label={formatMessage({
                    id: 'tiptap-editor.heading.seoTagAriaLabel',
                    defaultMessage: "Heading's HTML tag for SEO purposes",
                  })}
                  value={editorState?.headingTag}
                  onChange={(v: string | number) => v != null && onChangeHeadingTag(String(v))}
                  disabled={!editor || props.disabled || !editorState?.headingLevel}
                  size="S"
                >
                  {seoTagLevels.map((level) => (
                    <SingleSelectOption key={`h${level}`} value={`h${level}`}>
                      {`h${level}`}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Box>
            </Flex>
          </Box>
        </Popover.Content>
      </Popover.Root>
    ),
    headingTagSelect: null,
  };
}
