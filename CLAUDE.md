# Claude Code — Project Instructions

## Architecture Overview

- **`shared/`**:
  - `shared/types.ts`: Defines `TiptapPresetConfig`, `PRESET_FEATURE_KEYS` (48 feature keys), `BUILT_IN_PRESETS` (`minimal`, `default`, `full`, `edifice`), `TiptapRuntimeSettings`, `isFeatureEnabled`, and `getFeatureOptions`.
  - `shared/relations.ts`: Defines `extractRelationsFromJSON`, `parseStrapiLinkUri`, and `formatStrapiLinkUri` for relational media (`image`, `video`, `audio`, `attachment`) and internal link (`linker` & `strapi://collectionName/documentId`) extraction.
  - `shared/contentSerializer.ts`: Defines `serializeEditorContent` (`json`, `html`, `markdown`), `isSafeUrl`, `isSafeIframeUrl`, `sanitizeHtmlString`, `jsonToMarkdown`, and `markdownToJson`.
- **`server/src/`**:
  - `bootstrap.ts`: Registers RBAC actions (`settings.update`, `explorer.read`).
  - `services/` & `controllers/`: `preset`, `theme`, `settings` (RBAC-protected `PUT /settings`), `search` (RBAC-filtered `/search`, `/get/:collectionName/:documentId`, `/identify/:collectionName`), and `media` (DNS-aware SSRF-safe `/link-preview` with `assertSafeResolvedHost`, manual redirect handling, and 64 KB bounded stream, plus `/upload-by-url` persisted Upload record creation).
- **`admin/src/`**:
  - `extensions/`: Tiptap v3 extensions and toolbar hooks (`StarterKit`, `Heading`, `Link`, `Linker`, `Image`, `Video`, `Audio`, `Attachment`, `Iframe`, `Table`, `TextAlign`, `TextColor`, `HighlightColor`, `TypographyControls`, `SemanticMarks`, `InformationPane`, `StructuredBlocks`, `Mathematics`, `EmojiPicker`, `SlashCommand`, `SpeechTools`).
  - `components/`: `RichTextInput`, `ResponsiveToolbar`, `BaseTiptapInput`, `EditorFooterAndModes`, `ImageEditorModal`, `ImageAltPopover`, `MediaLibraryWrapper`, `ToolbarButton`, `Spacer`.
  - `utils/`: `buildExtensions.ts` and `customExtensionRegistry.ts` (`registerTiptapExtension`, `unregisterTiptapExtension`, `getRegisteredTiptapExtension`, `getRegisteredTiptapExtensions`, `isCustomExtensionEnabledForPreset`).
  - `hooks/`: `usePresetConfig`, `useKeyboardNavigation` (WCAG 2.1 AA roving focus), `useRelationalSync` (`<FieldName>Media` & `<FieldName>Links`).
  - `pages/`: `SettingsPage.tsx` (`/settings/tiptap-editor`).

## Fixture & Test Maintenance

1. When any editor extension or toolbar feature is added, removed, or modified under `admin/src/extensions/`, `admin/src/utils/buildExtensions.ts`, or `shared/types.ts` (specifically `TiptapPresetConfig` or `PRESET_FEATURE_KEYS`), you **must** update `fixtures/all-features-payload.json` so it exercises every supported node, mark, and attribute. The payload uses Tiptap/ProseMirror JSON format.
2. Do not import `@strapi/strapi/admin` at the top level of extension modules imported by `admin/src/utils/buildExtensions.ts` so unit tests can import `buildExtensions` without loading the full Strapi Admin runtime.
3. Run `pnpm test`, `pnpm run test:ts:front`, `pnpm run test:ts:back`, and `pnpm build && pnpm verify` before committing. This repository uses pnpm (see `packageManager` in `package.json`); do not add `yarn.lock` or `package-lock.json`.
