import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock React hooks: the hook is called as a plain function ─────────────────
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (init: any) => [typeof init === 'function' ? init() : init, vi.fn()],
    useMemo: (fn: () => any) => fn(),
    useEffect: vi.fn(),
    useRef: (value: any) => ({ current: value }),
  };
});

// ─── Mock @tiptap/react: capture the options and let the test drive the events ─
const mockUseEditor = vi.fn();
vi.mock('@tiptap/react', () => ({ useEditor: (options: any) => mockUseEditor(options) }));

// ─── Mock Strapi's form field ─────────────────────────────────────────────────
const onChange = vi.fn();
let mockFieldValue: any = '';
vi.mock('@strapi/strapi/admin', () => ({
  useField: () => ({ value: mockFieldValue, onChange }),
}));

import StarterKit from '@tiptap/starter-kit';
import { useTiptapEditor } from '../../admin/src/utils/tiptapUtils';

const fakeEditor = { getJSON: () => ({ type: 'doc', content: [] }) };

describe('useTiptapEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFieldValue = '';
    mockUseEditor.mockImplementation(() => fakeEditor);
  });

  it('reports no content error when the editor mounts cleanly', () => {
    const result = useTiptapEditor('body', '', [StarterKit]);
    expect(result.editor).toBe(fakeEditor);
    expect(result.contentError).toBe(false);
  });

  it('flags a content error raised while the editor is created', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseEditor.mockImplementation((options: any) => {
      options.onContentError({
        editor: fakeEditor,
        error: new Error('[tiptap error]: Invalid JSON content'),
      });
      return fakeEditor;
    });

    const result = useTiptapEditor('body', '', [StarterKit]);

    expect(result.contentError).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid content in field "body"'),
      expect.any(Error)
    );
    spy.mockRestore();
  });

  it('still persists edits after a content error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUseEditor.mockImplementation((options: any) => {
      options.onContentError({ editor: fakeEditor, error: new Error('x') });
      options.onUpdate({ editor: fakeEditor });
      return fakeEditor;
    });

    useTiptapEditor('body', '', [StarterKit]);

    expect(onChange).toHaveBeenCalledWith('body', expect.any(String));
    expect(JSON.parse(onChange.mock.calls[0][1])).toMatchObject({
      type: 'doc',
      content: [],
      words: 0,
      characters: 0,
    });
  });

  it('sets editable: false and blocks field.onChange / onDocUpdate when disabled is true', () => {
    const onDocUpdate = vi.fn();
    let capturedOptions: any = null;
    mockUseEditor.mockImplementation((options: any) => {
      capturedOptions = options;
      options.onUpdate({ editor: fakeEditor });
      return fakeEditor;
    });

    useTiptapEditor('body', '', [StarterKit], { disabled: true, onDocUpdate });

    expect(capturedOptions.editable).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(onDocUpdate).not.toHaveBeenCalled();
  });

  it('marks non-doc JSON values as contentError instead of silently wiping to empty doc', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFieldValue = '{"unexpected":"shape"}';

    const result = useTiptapEditor('body', '', [StarterKit], { outputFormat: 'json' });
    spy.mockRestore();

    expect(result.contentError).toBe(true);
  });

  it('refreshes mounted React NodeViews via view.setProps + createNodeViews when editable state transitions', async () => {
    const { setEditorEditableWithNodeViews } = await import('../../admin/src/utils/tiptapUtils');

    const setEditable = vi.fn(function (this: any, val: boolean) {
      this.isEditable = val;
    });
    const setProps = vi.fn();
    const createNodeViews = vi.fn();
    const mountedEditor = {
      isDestroyed: false,
      isEditable: true,
      setEditable,
      contentComponent: {},
      createNodeViews,
      view: { isDestroyed: false, setProps },
    };

    // No-op when already true
    setEditorEditableWithNodeViews(mountedEditor, true);
    expect(setEditable).not.toHaveBeenCalled();

    // Transition true -> false refreshes NodeViews
    setEditorEditableWithNodeViews(mountedEditor, false);
    expect(setEditable).toHaveBeenCalledWith(false, false);
    expect(setProps).toHaveBeenCalledWith({ markViews: {}, nodeViews: {} });
    expect(createNodeViews).toHaveBeenCalledTimes(1);

    // Safe no-op on plain mock editors lacking setEditable / contentComponent
    expect(() => setEditorEditableWithNodeViews(fakeEditor as any, false)).not.toThrow();
  });
});
