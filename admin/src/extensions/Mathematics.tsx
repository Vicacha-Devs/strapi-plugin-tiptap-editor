import React, { useState } from 'react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import {
  Button,
  Dialog,
  Field,
  SingleSelect,
  SingleSelectOption,
  TextInput,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { ToolbarButton } from '../components/ToolbarButton';

export interface MathematicsOptions {
  enableContentCheck: boolean;
  HTMLAttributes: Record<string, unknown>;
}

const LATEX_SYMBOLS = [
  { label: '∑ Sum', snippet: '\\sum_{i=1}^{n} ' },
  { label: '∫ Integral', snippet: '\\int_{a}^{b} ' },
  { label: 'a/b Fraction', snippet: '\\frac{a}{b}' },
  { label: '√ Root', snippet: '\\sqrt{x}' },
  { label: 'α Alpha', snippet: '\\alpha' },
  { label: 'β Beta', snippet: '\\beta' },
  { label: 'π Pi', snippet: '\\pi' },
  { label: '∞ Infinity', snippet: '\\infty' },
  { label: '± Plus/Minus', snippet: '\\pm' },
  { label: '≠ Not Equal', snippet: '\\neq' },
  { label: '≤ Less/Equal', snippet: '\\leq' },
  { label: '≥ Greater/Equal', snippet: '\\geq' },
  { label: '→ Arrow', snippet: '\\rightarrow' },
];

export function formatLatexPreview(latex: string): string {
  if (!latex) return '';
  return latex
    .replace(/\\sum/g, '∑')
    .replace(/\\int/g, '∫')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\pi/g, 'π')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\times/g, '×');
}

export function MathematicsNodeViewReadOnly({ node }: NodeViewProps) {
  const latex = String(node.attrs.latex ?? '');
  const displayMode = node.attrs.displayMode === 'block' ? 'block' : 'inline';
  const rendered = formatLatexPreview(latex);

  return (
    <NodeViewWrapper
      as={displayMode === 'block' ? 'div' : 'span'}
      data-type="mathematics"
      style={{
        display: displayMode === 'block' ? 'block' : 'inline-block',
        textAlign: displayMode === 'block' ? 'center' : undefined,
        padding: displayMode === 'block' ? '10px 14px' : '1px 6px',
        margin: displayMode === 'block' ? '0.5em 0' : '0 2px',
        backgroundColor: '#f6f6f9',
        border: '1px solid #dcdce4',
        borderRadius: '4px',
        fontFamily: 'Cambria Math, Georgia, serif',
        fontStyle: 'italic',
      }}
    >
      <span role="math" aria-label={`Mathematical formula: ${latex}`}>
        {rendered || latex}
      </span>
    </NodeViewWrapper>
  );
}

export const MathematicsNode = Node.create<MathematicsOptions>({
  name: 'mathematics',
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
      latex: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-latex') ?? el.textContent ?? '',
        renderHTML: (attrs: Record<string, unknown>) => ({
          'data-latex': String(attrs.latex ?? ''),
        }),
      },
      displayMode: {
        default: 'inline',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-display') ?? 'inline',
        renderHTML: (attrs: Record<string, unknown>) => ({
          'data-display': String(attrs.displayMode ?? 'inline'),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mathematics"]' }, { tag: 'div[data-type="mathematics"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = String(HTMLAttributes['data-latex'] ?? '');
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mathematics',
        role: 'math',
        'aria-label': latex,
      }),
      latex,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathematicsNodeViewReadOnly);
  },
});

export function useMathematics(
  editor: Editor | null,
  props: { disabled?: boolean } = { disabled: false }
) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const [latex, setLatex] = useState('E = mc^2');
  const [displayMode, setDisplayMode] = useState<'inline' | 'block'>('inline');

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isInCodeBlock: ctx.editor?.isActive('codeBlock') ?? false,
    }),
  });

  const handleInsert = () => {
    if (!editor || !latex.trim()) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'mathematics',
        attrs: {
          latex: latex.trim(),
          displayMode,
        },
      })
      .run();
    setOpen(false);
  };

  const mathematicsButton = (
    <ToolbarButton
      onClick={() => setOpen(true)}
      icon={<span style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'serif' }}>∑x</span>}
      active={false}
      disabled={props.disabled || !editor || (editorState?.isInCodeBlock ?? false)}
      tooltip={formatMessage({
        id: 'tiptap-editor.toolbar.mathematics',
        defaultMessage: 'Insert mathematical formula (LaTeX)',
      })}
    />
  );

  const mathematicsDialog = (
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
              id: 'tiptap-editor.mathematics.dialogHeader',
              defaultMessage: 'Insert Mathematical Equation (LaTeX)',
            })}
          </Dialog.Header>
          <Dialog.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {LATEX_SYMBOLS.map((sym) => (
                  <Button
                    key={sym.label}
                    size="S"
                    variant="tertiary"
                    onClick={() => setLatex((prev) => `${prev}${sym.snippet}`)}
                  >
                    {sym.label}
                  </Button>
                ))}
              </div>
              <Field.Root width="100%">
                <Field.Label>
                  {formatMessage({
                    id: 'tiptap-editor.mathematics.latexLabel',
                    defaultMessage: 'LaTeX Expression',
                  })}
                </Field.Label>
                <TextInput
                  name="math-latex"
                  placeholder="\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"
                  value={latex}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLatex(e.target.value)}
                />
              </Field.Root>
              <Field.Root width="100%">
                <Field.Label>
                  {formatMessage({
                    id: 'tiptap-editor.mathematics.displayModeLabel',
                    defaultMessage: 'Display Mode',
                  })}
                </Field.Label>
                <SingleSelect
                  value={displayMode}
                  onChange={(v: string | number) =>
                    setDisplayMode(String(v) === 'block' ? 'block' : 'inline')
                  }
                >
                  <SingleSelectOption value="inline">Inline ($...$)</SingleSelectOption>
                  <SingleSelectOption value="block">Block Equation ($$...$$)</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
              <div
                aria-live="polite"
                style={{
                  padding: '12px',
                  backgroundColor: '#f6f6f9',
                  borderRadius: '6px',
                  border: '1px solid #dcdce4',
                  textAlign: 'center',
                  fontFamily: 'Cambria Math, Georgia, serif',
                  fontSize: '1.6rem',
                  fontStyle: 'italic',
                }}
              >
                {formatLatexPreview(latex) || 'Preview'}
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
                onClick={handleInsert}
                disabled={!latex.trim()}
              >
                {formatMessage({ id: 'tiptap-editor.common.insert', defaultMessage: 'Insert' })}
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      )}
    </Dialog.Root>
  );

  return { mathematicsButton, mathematicsDialog };
}
