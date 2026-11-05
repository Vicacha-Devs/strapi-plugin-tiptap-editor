# Claude Code — Project Instructions

## Architecture Overview

- **`shared/src/`**:
  - `shared/src/types.ts`: Defines `TiptapPresetConfig`, `PRESET_FEATURE_KEYS` (49 feature keys including `components`), `BUILT_IN_PRESETS` (`minimal`, `default`, `full`, `edifice`), `TiptapRuntimeSettings`, `isFeatureEnabled`, `getFeatureOptions`, `isComponentEnabled`, and `getComponentOptions`.
  - `shared/src/components/`: Defines `RichTextComponentSchema`, `toNodeSpec`, `isInlineComponent`, `buttonSchema`, `BUILT_IN_COMPONENT_SCHEMAS`, and reserved node-name validation (`RESERVED_NODE_NAMES`).
  - `shared/src/table.ts`: Defines `cellBackgroundAttribute`, `TableCellWithBackground`, and `TableHeaderWithBackground`.
  - `shared/src/sanitize.ts`: Defines `stripUnknownContent` for safe schema-aware ProseMirror JSON sanitization.
  - `shared/src/relations.ts`: Defines `extractRelationsFromJSON`, `parseStrapiLinkUri`, and `formatStrapiLinkUri` for relational media (`image`, `video`, `audio`, `attachment`) and internal link (`linker` & `strapi://collectionName/documentId`) extraction.
  - `shared/src/contentSerializer.ts`: Defines `serializeEditorContent` (`json`, `html`, `markdown`), `isSafeUrl`, `isSafeIframeUrl`, `sanitizeHtmlString`, `jsonToMarkdown`, and `markdownToJson`.
- **`server/src/`**:
  - `bootstrap.ts`: Registers RBAC actions (`settings.update`, `explorer.read`).
  - `services/` & `controllers/`: `preset`, `theme`, `settings` (RBAC-protected `PUT /settings`), `search` (RBAC-filtered `/search`, `/get/:collectionName/:documentId`, `/identify/:collectionName`), and `media` (DNS-aware SSRF-safe `/link-preview` with `assertSafeResolvedHost`, manual redirect handling, and 64 KB bounded stream, plus `/upload-by-url` persisted Upload record creation).
- **`admin/src/`**:
  - `extensions/`: Tiptap v3 extensions and toolbar hooks (`StarterKit`, `Heading`, `Link`, `Linker`, `Image`, `Video`, `Audio`, `Attachment`, `Iframe`, `Table`, `TableCellBackground`, `Components`, `TextAlign`, `TextColor`, `HighlightColor`, `TypographyControls`, `SemanticMarks`, `InformationPane`, `StructuredBlocks`, `Mathematics`, `EmojiPicker`, `SlashCommand`, `SpeechTools`, plus `builtins/button.tsx`).
  - `components/`: `RichTextInput`, `ResponsiveToolbar`, `BaseTiptapInput`, `EditorFooterAndModes`, `ImageEditorModal`, `ImageAltPopover`, `ComponentDialog`, `ComponentAttributeForm`, `ComponentNodeView`, `InlineComponentNodeView`, `MediaLibraryWrapper`, `ToolbarButton`, `Spacer`.
  - `registry/`: `richTextComponents.ts` (`defineRichTextComponent`, `registerRichTextComponent`, `listRichTextComponents`).
  - `utils/`: `buildExtensions.ts`, `tiptapUtils.tsx`, and `customExtensionRegistry.ts` (`registerTiptapExtension`, `unregisterTiptapExtension`, `getRegisteredTiptapExtension`, `getRegisteredTiptapExtensions`, `isCustomExtensionEnabledForPreset`).
  - `hooks/`: `usePresetConfig`, `useKeyboardNavigation` (WCAG 2.1 AA roving focus), `useRelationalSync` (`<FieldName>Media` & `<FieldName>Links`).
  - `pages/`: `SettingsPage.tsx` (`/settings/tiptap-editor`).

## Fixture & Test Maintenance

1. When any editor extension or toolbar feature is added, removed, or modified under `admin/src/extensions/`, `admin/src/utils/buildExtensions.ts`, or `shared/src/types.ts` (specifically `TiptapPresetConfig` or `PRESET_FEATURE_KEYS`), you **must** update `fixtures/all-features-payload.json` so it exercises every supported node, mark, and attribute. The payload uses Tiptap/ProseMirror JSON format.
2. Run `yarn test`, `yarn test:ts:shared`, `yarn test:ts:front`, `yarn test:ts:back`, and `yarn build && yarn verify` before committing.
