# Claude Code — Project Instructions

## Fixture & Test Maintenance

1. When any editor extension or toolbar feature is added, removed, or modified under `admin/src/extensions/`, `admin/src/utils/buildExtensions.ts`, or `shared/types.ts` (specifically `TiptapPresetConfig` or `PRESET_FEATURE_KEYS`), you **must** update `fixtures/all-features-payload.json` so it exercises every supported node, mark, and attribute. The payload uses Tiptap/ProseMirror JSON format.
2. Do not import `@strapi/strapi/admin` at the top level of extension modules imported by `admin/src/utils/buildExtensions.ts` so unit tests can import `buildExtensions` without loading the full Strapi Admin runtime.
3. Run `npm test`, `npx tsc -p admin/tsconfig.json --noEmit`, `npx tsc -p server/tsconfig.json --noEmit`, and `npm run build && npm run verify` before committing.
