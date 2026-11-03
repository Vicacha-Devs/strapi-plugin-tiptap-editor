// shared/src/table.ts

/** Node attribute holding a table cell's background color, on both `tableCell` and `tableHeader`. */
export const CELL_BACKGROUND_ATTRIBUTE = 'backgroundColor';

const SAFE_CSS_COLOR =
  /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%/-]+\)|var\(--[\w-]+\)|[a-z]+)$/i;

export const toSafeCellBackgroundColor = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value && SAFE_CSS_COLOR.test(value) ? value : null;
};

/**
 * Tiptap attribute spec for the cell background. Kept free of Tiptap imports so a host renderer
 * can extend its own `TableCell`/`TableHeader` with the exact same parse and render rules.
 */
export const cellBackgroundAttribute = {
  default: null as string | null,
  // Read through data-background-color or CSSOM style and validate safe CSS color syntax.
  parseHTML: (element: {
    getAttribute?: (name: string) => string | null;
    style?: { backgroundColor?: string };
  }): string | null =>
    toSafeCellBackgroundColor(
      element.getAttribute?.('data-background-color') || element.style?.backgroundColor
    ),
  renderHTML: (attributes: Record<string, unknown>): Record<string, string> => {
    const color = toSafeCellBackgroundColor(attributes[CELL_BACKGROUND_ATTRIBUTE]);
    return color ? { style: `background-color: ${color}` } : {};
  },
};
