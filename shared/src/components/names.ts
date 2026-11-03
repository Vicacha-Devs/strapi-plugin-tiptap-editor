export const COMPONENT_NAME_RE = /^[a-zA-Z][\w-]*$/;

/** Node and mark names the editor already defines; a component may never shadow them. */
export const RESERVED_NODE_NAMES: ReadonlySet<string> = new Set([
  'doc',
  'text',
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'horizontalRule',
  'image',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'video',
  'audio',
  'attachment',
  'iframe',
  'linker',
  'informationPane',
  'mathematics',
  'leadParagraph',
  'details',
  'detailsSummary',
  'detailsContent',
  'conversationHistory',
  'layoutContainer',
  'layoutColumn',
  'taskList',
  'taskItem',
  'pageBreak',
  'tableOfContents',
  // Marks share the schema's namespace with nodes.
  'link',
  'bold',
  'italic',
  'strike',
  'code',
  'underline',
  'highlight',
  'textStyle',
  'superscript',
  'subscript',
  'language',
  'abbr',
]);

export const isReservedNodeName = (name: string): boolean => RESERVED_NODE_NAMES.has(name);

export const isValidComponentName = (name: string): boolean =>
  COMPONENT_NAME_RE.test(name) && !isReservedNodeName(name);
