# Claude Code — Project Instructions

## Architecture Overview

- **`shared/`**:
  - `shared/types.ts`: Defines `TiptapPresetConfig`, `PRESET_FEATURE_KEYS` (48 feature keys), `BUILT_IN_PRESETS` (`minimal`, `default`, `full`, `edifice`), `TiptapRuntimeSettings`, `isFeatureEnabled`, and `getFeatureOptions`.
  - `shared/relations.ts`: Defines `extractRelationsFromJSON`, `parseStrapiLinkUri`, and `formatStrapiLinkUri` for relational media (`image`, `video`, `audio`, `attachment`) and internal link (`linker` & `strapi://collectionName/documentId`) extraction.
  - `shared/contentSerializer.ts`: Defines `serializeEditorContent` (`json`, `html`, `markdown`), `isSafeUrl`, `isSafeIframeUrl`, `sanitizeHtmlString`, `jsonToMarkdown`, and `markdownToJson`.
- **`server/src/`**:
  - `bootstrap.ts`: Initializes runtime settings in `core-store` and registers the `links.links` component for relational internal link tracking.
  - `services/` & `controllers/`: `preset`, `theme`, `settings`, `search` (`/search`, `/get/:collectionName/:documentId`, `/identify/:collectionName`), and `media` (SSRF-safe `/link-preview` and `/upload-by-url`).
- **`admin/src/`**:
  - `extensions/`: Tiptap v3 extensions and toolbar hooks (`StarterKit`, `Heading`, `Link`, `Linker`, `Image`, `Video`, `Audio`, `Attachment`, `Iframe`, `Table`, `TextAlign`, `TextColor`, `HighlightColor`, `TypographyControls`, `SemanticMarks`, `InformationPane`, `StructuredBlocks`, `Mathematics`, `EmojiPicker`, `SlashCommand`, `SpeechTools`).
  - `components/`: `RichTextInput`, `BaseTiptapInput`, `EditorFooterAndModes`, `ImageEditorModal`, `ImageAltPopover`, `MediaLibraryWrapper`, `ToolbarButton`.
  - `hooks/`: `usePresetConfig`, `useKeyboardNavigation` (WCAG 2.1 AA roving focus), `useRelationalSync` (`<FieldName>Media` & `<FieldName>Links`).
  - `pages/`: `SettingsPage.tsx` (`/settings/tiptap-editor`).

## Fixture & Test Maintenance

1. When any editor extension or toolbar feature is added, removed, or modified under `admin/src/extensions/`, `admin/src/utils/buildExtensions.ts`, or `shared/types.ts` (specifically `TiptapPresetConfig` or `PRESET_FEATURE_KEYS`), you **must** update `fixtures/all-features-payload.json` so it exercises every supported node, mark, and attribute. The payload uses Tiptap/ProseMirror JSON format.
2. Do not import `@strapi/strapi/admin` at the top level of extension modules imported by `admin/src/utils/buildExtensions.ts` so unit tests can import `buildExtensions` without loading the full Strapi Admin runtime.
3. Run `npm test`, `npx tsc -p admin/tsconfig.json --noEmit`, `npx tsc -p server/tsconfig.json --noEmit`, and `npm run build && npm run verify` before committing.
