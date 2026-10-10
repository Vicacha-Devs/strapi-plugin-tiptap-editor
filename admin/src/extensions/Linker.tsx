import React, { useState, useEffect } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Button, Dialog, Field, TextInput } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';
import { formatStrapiLinkUri, parseStrapiLinkUri } from '../../../shared/relations';

async function fetchPluginJson<T = unknown>(path: string): Promise<{ data?: T }> {
  const res = await fetch(path, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as T;
  return { data };
}

export interface StrapiLinkerOptions {
  enableContentCheck: boolean;
  HTMLAttributes: Record<string, unknown>;
}

interface SearchHit {
  documentId: string;
  id?: number | string;
  label: string;
  collectionName: string;
  status: string;
  locale?: string;
}

export function LinkerNodeViewReadOnly({ node }: NodeViewProps) {
  const { collectionName, documentId, label, href } = node.attrs;
  const shortCollection =
    typeof collectionName === 'string' && collectionName.includes('.')
      ? collectionName.split('.')[1]
      : collectionName || 'content';
  const displayLabel = label || documentId || 'Internal Link';

  return (
    <NodeViewWrapper
      as="span"
      data-type="linker"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '1px 8px',
        margin: '0 2px',
        borderRadius: '12px',
        backgroundColor: '#f0f0ff',
        border: '1px solid #d9d8ff',
        color: '#271fe0',
        fontSize: '0.9em',
        fontWeight: 500,
        verticalAlign: 'baseline',
      }}
      title={href || formatStrapiLinkUri(String(collectionName || ''), String(documentId || ''))}
    >
      <span
        style={{
          fontSize: '0.75em',
          textTransform: 'uppercase',
          backgroundColor: '#4945ff',
          color: '#fff',
          borderRadius: '8px',
          padding: '0 5px',
          fontWeight: 700,
        }}
      >
        {shortCollection}
      </span>
      <span>{displayLabel}</span>
    </NodeViewWrapper>
  );
}

export function LinkerNodeView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const { collectionName, documentId, label } = node.attrs;

  useEffect(() => {
    let mounted = true;
    if (!collectionName || !documentId) return;

    fetchPluginJson<{ label?: string; status?: string }>(
      `/tiptap-editor/get/${encodeURIComponent(collectionName)}/${encodeURIComponent(documentId)}`
    )
      .then((res) => {
        if (!mounted) return;
        const resolvedLabel = res.data?.label;
        if (resolvedLabel && resolvedLabel !== label) {
          updateAttributes({ label: resolvedLabel, status: res.data?.status ?? null });
        }
      })
      .catch(() => {
        // Keep existing label if offline or endpoint not reachable
      });

    return () => {
      mounted = false;
    };
  }, [collectionName, documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <NodeViewWrapper
      as="span"
      data-type="linker"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '1px 8px',
        margin: '0 2px',
        borderRadius: '12px',
        backgroundColor: selected ? '#e0e0ff' : '#f0f0ff',
        border: selected ? '1px solid #4945ff' : '1px solid #d9d8ff',
        color: '#271fe0',
        fontSize: '0.9em',
        fontWeight: 500,
      }}
    >
      <LinkerNodeViewReadOnly {...props} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          deleteNode();
        }}
        aria-label="Remove internal link"
        style={{
          border: 'none',
          background: 'transparent',
          color: '#666687',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '1.1rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </NodeViewWrapper>
  );
}

export const StrapiLinker = Node.create<StrapiLinkerOptions>({
  name: 'linker',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return {
      enableContentCheck: false,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      collectionName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-collection') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.collectionName ? { 'data-collection': String(attrs.collectionName) } : {},
      },
      documentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-document-id') ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.documentId ? { 'data-document-id': String(attrs.documentId) } : {},
      },
      label: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-label') ?? el.textContent ?? null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.label ? { 'data-label': String(attrs.label) } : {},
      },
      href: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const href = el.getAttribute('href');
          if (href) return href;
          const col = el.getAttribute('data-collection');
          const docId = el.getAttribute('data-document-id');
          return col && docId ? formatStrapiLinkUri(col, docId) : null;
        },
        renderHTML: (attrs: Record<string, unknown>) => {
          if (attrs.href) return { href: String(attrs.href) };
          if (attrs.collectionName && attrs.documentId) {
            return {
              href: formatStrapiLinkUri(String(attrs.collectionName), String(attrs.documentId)),
            };
          }
          return {};
        },
      },
      status: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'a[data-type="linker"]' },
      {
        tag: 'a[href^="strapi://"]',
        getAttrs: (dom: HTMLElement) => {
          const parsed = parseStrapiLinkUri(dom.getAttribute('href'));
          if (!parsed) return false;
          return {
            collectionName: parsed.collectionName,
            documentId: parsed.documentId,
            label: dom.textContent || parsed.documentId,
            href: formatStrapiLinkUri(parsed.collectionName, parsed.documentId),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes['data-label'] || HTMLAttributes['data-document-id'] || 'Link');
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'linker',
      }),
      label,
    ];
  },

  addNodeView() {
    if (this.options.enableContentCheck) {
      return ReactNodeViewRenderer(LinkerNodeViewReadOnly);
    }
    return ReactNodeViewRenderer(LinkerNodeView);
  },
});

export function useLinker(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [manualCollection, setManualCollection] = useState('api::article.article');
  const [manualDocId, setManualDocId] = useState('');
  const [manualLabel, setManualLabel] = useState('');

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      return;
    }
    let mounted = true;
    const timeout = setTimeout(() => {
      fetchPluginJson<{ results?: Record<string, SearchHit[]> }>(
        `/tiptap-editor/search?q=${encodeURIComponent(query.trim())}`
      )
        .then((res) => {
          if (!mounted) return;
          const grouped = res.data?.results || {};
          const flattened = Object.values(grouped).flat();
          setResults(flattened);
        })
        .catch(() => {
          if (mounted) setResults([]);
        });
    }, 200);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [open, query]);

  const handleSelectHit = (hit: SearchHit) => {
    if (!editor) return;
    const href = formatStrapiLinkUri(hit.collectionName, hit.documentId);
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'linker',
        attrs: {
          collectionName: hit.collectionName,
          documentId: hit.documentId,
          label: hit.label,
          href,
          status: hit.status,
        },
      })
      .run();
    setOpen(false);
  };

  const handleManualInsert = () => {
    if (!editor || !manualCollection.trim() || !manualDocId.trim()) return;
    const href = formatStrapiLinkUri(manualCollection, manualDocId);
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'linker',
        attrs: {
          collectionName: manualCollection.trim(),
          documentId: manualDocId.trim(),
          label: manualLabel.trim() || manualDocId.trim(),
          href,
        },
      })
      .run();
    setManualDocId('');
    setManualLabel('');
    setOpen(false);
  };

  const linkerButton = (
    <ToolbarButton
      onClick={() => setOpen(true)}
      icon={<span style={{ fontSize: '1.1rem', fontWeight: 700 }}>🔗 Content</span>}
      active={false}
      disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.internalLinker',
        defaultMessage: 'Insert internal Strapi content link (Linker)',
      })}
    />
  );

  const linkerDialog = (
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
              id: 'tiptap-editor.linker.dialogHeader',
              defaultMessage: 'Link to Internal Strapi Content (Auto-Synced with <Field>Links)',
            })}
          </Dialog.Header>
          <Dialog.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <Field.Root width="100%">
                <Field.Label>
                  {formatMessage({
                    id: 'tiptap-editor.linker.searchLabel',
                    defaultMessage: 'Search Collection Entries',
                  })}
                </Field.Label>
                <TextInput
                  name="linker-search"
                  placeholder="Type title or documentId to search..."
                  value={query}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                />
              </Field.Root>

              {results.length > 0 && (
                <div
                  role="listbox"
                  aria-label="Search results"
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #dcdce4',
                    borderRadius: '6px',
                  }}
                >
                  {results.map((hit) => (
                    <button
                      key={`${hit.collectionName}-${hit.documentId}`}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSelectHit(hit)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        borderBottom: '1px solid #f0f0ff',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1.3rem', color: '#32324d' }}>
                          {hit.label}
                        </div>
                        <div style={{ fontSize: '1.1rem', color: '#666687' }}>
                          {hit.collectionName} · {hit.documentId}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '1.1rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: hit.status === 'published' ? '#eafbe7' : '#fdf4dc',
                          color: hit.status === 'published' ? '#2f6846' : '#be5d01',
                        }}
                      >
                        {hit.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  borderTop: '1px solid #dcdce4',
                  paddingTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#666687' }}>
                  Or specify Collection UID & Document ID directly:
                </span>
                <TextInput
                  name="linker-collection"
                  placeholder="api::article.article"
                  value={manualCollection}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setManualCollection(e.target.value)
                  }
                  aria-label="Collection UID"
                />
                <TextInput
                  name="linker-docid"
                  placeholder="documentId (e.g. abc123xyz)"
                  value={manualDocId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setManualDocId(e.target.value)
                  }
                  aria-label="Document ID"
                />
                <TextInput
                  name="linker-label"
                  placeholder="Display label"
                  value={manualLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setManualLabel(e.target.value)
                  }
                  aria-label="Display label"
                />
              </div>
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary" fullWidth onClick={() => setOpen(false)}>
                {formatMessage({ id: 'tiptap-editor.common.cancel', defaultMessage: 'Cancel' })}
              </Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                variant="success-light"
                fullWidth
                onClick={handleManualInsert}
                disabled={!manualCollection.trim() || !manualDocId.trim()}
              >
                {formatMessage({ id: 'tiptap-editor.common.insert', defaultMessage: 'Insert' })}
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      )}
    </Dialog.Root>
  );

  return { linkerButton, linkerDialog };
}
