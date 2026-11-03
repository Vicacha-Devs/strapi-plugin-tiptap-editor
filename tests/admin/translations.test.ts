import fs from 'node:fs';
import path from 'node:path';
import { createIntl, createIntlCache } from 'react-intl';
import { describe, expect, it } from 'vitest';

const TRANSLATIONS_DIR = path.resolve(__dirname, '../../admin/src/translations');
const ADMIN_SRC_DIR = path.resolve(__dirname, '../../admin/src');

const LOCALES = ['ar', 'cs', 'de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'tr'] as const;
type SupportedLocale = (typeof LOCALES)[number];

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
]);

/**
 * Extracts sorted unique ICU MessageFormat `{placeholder}` variable names from a message string,
 * handling single-quote escaping (`''`, `'{'`, `'<tag>'`) and nested `plural` / `select` /
 * `selectordinal` submessages accurately.
 */
function extractIcuPlaceholders(message: string): string[] {
  const vars = new Set<string>();

  function parseSegment(str: string, startIndex: number, stopAtClosingBrace: boolean): number {
    let i = startIndex;
    while (i < str.length) {
      const ch = str[i];

      if (ch === "'") {
        if (str[i + 1] === "'") {
          i += 2;
          continue;
        }
        const next = str[i + 1];
        if (next === '{' || next === '}' || next === '<' || next === '>' || next === '#') {
          i += 2;
          while (i < str.length) {
            if (str[i] === "'") {
              if (str[i + 1] === "'") {
                i += 2;
                continue;
              }
              i += 1;
              break;
            }
            i += 1;
          }
          continue;
        }
        i += 1;
        continue;
      }

      if (stopAtClosingBrace && ch === '}') {
        return i + 1;
      }

      if (ch === '{') {
        i += 1;
        while (i < str.length && /\s/.test(str[i])) i += 1;

        const nameStart = i;
        while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) i += 1;
        const varName = str.slice(nameStart, i);
        if (varName) {
          vars.add(varName);
        }

        while (i < str.length && /\s/.test(str[i])) i += 1;

        if (str[i] === '}') {
          i += 1;
          continue;
        }

        if (str[i] === ',') {
          i += 1;
          while (i < str.length && /\s/.test(str[i])) i += 1;
          const typeStart = i;
          while (i < str.length && /[a-zA-Z]/.test(str[i])) i += 1;
          const argType = str.slice(typeStart, i).toLowerCase();

          while (i < str.length && /\s/.test(str[i])) i += 1;

          if (str[i] === '}') {
            i += 1;
            continue;
          }

          if (
            str[i] === ',' &&
            (argType === 'plural' || argType === 'select' || argType === 'selectordinal')
          ) {
            i += 1;
            // Parse selector clauses: `one {submessage} other {submessage}` until matching `}`
            while (i < str.length) {
              while (i < str.length && /\s/.test(str[i])) i += 1;
              if (str[i] === '}') {
                i += 1;
                break;
              }
              // Skip offset:... or selector token (e.g. `=0`, `one`, `other`)
              while (i < str.length && str[i] !== '{' && str[i] !== '}') {
                i += 1;
              }
              if (str[i] === '{') {
                i = parseSegment(str, i + 1, true);
              }
            }
            continue;
          }
        }

        // Fallback for non-choice formatted arguments (e.g. `{val, number, ::currency/USD}`)
        let depth = 1;
        while (i < str.length && depth > 0) {
          if (str[i] === '{') depth += 1;
          else if (str[i] === '}') depth -= 1;
          i += 1;
        }
        continue;
      }

      i += 1;
    }
    return i;
  }

  parseSegment(message, 0, false);
  return [...vars].sort();
}

/**
 * Recursively collects all `.ts` and `.tsx` files within a directory boundary.
 */
function collectSourceFiles(dir: string): string[] {
  const resolvedRoot = path.resolve(dir);
  const results: string[] = [];

  function walk(currentDir: string): void {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.resolve(currentDir, entry.name);
      if (!fullPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error(`Directory traversal blocked: ${fullPath}`);
      }
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(resolvedRoot);
  return results.sort();
}

function loadLocaleRawAndParsed(locale: SupportedLocale): {
  raw: string;
  messages: Record<string, string>;
} {
  const safeFilename = path.basename(`${locale}.json`);
  const filePath = path.resolve(TRANSLATIONS_DIR, safeFilename);
  if (!filePath.startsWith(TRANSLATIONS_DIR + path.sep)) {
    throw new Error(`Invalid locale path: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${safeFilename} must parse as a plain JSON object`);
  }
  return { raw, messages: parsed as Record<string, string> };
}

describe('i18n translation files (11-locale parity & ICU safety)', () => {
  const loadedLocales = Object.fromEntries(
    LOCALES.map((locale) => [locale, loadLocaleRawAndParsed(locale)])
  ) as Record<SupportedLocale, { raw: string; messages: Record<string, string> }>;

  const enMessages = loadedLocales.en.messages;
  const sortedEnKeys = Object.keys(enMessages).sort();

  it('contains all 11 expected locale JSON files on disk', () => {
    const filesOnDisk = fs
      .readdirSync(TRANSLATIONS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();
    expect(filesOnDisk).toEqual(LOCALES.map((l) => `${l}.json`).sort());
  });

  it.each(LOCALES)(
    '%s.json parses as valid JSON with unique, safe keys and non-empty string values',
    (locale) => {
      const { raw, messages } = loadedLocales[locale];

      // Ensure no duplicate keys in raw JSON text
      const seenKeys = new Set<string>();
      const duplicates: string[] = [];
      for (const line of raw.split('\n')) {
        const match = line.match(/^\s*"([^"]+)"\s*:/);
        if (match) {
          const key = match[1];
          if (seenKeys.has(key)) {
            duplicates.push(key);
          }
          seenKeys.add(key);
        }
      }
      expect(duplicates).toEqual([]);

      const entries = Object.entries(messages);
      expect(entries.length).toBeGreaterThanOrEqual(444);

      for (const [key, value] of entries) {
        expect(FORBIDDEN_KEYS.has(key)).toBe(false);
        expect(key.startsWith('tiptap-editor.')).toBe(true);
        expect(typeof value).toBe('string');
        expect(value.trim().length, `Empty translation for "${key}" in ${locale}.json`).toBeGreaterThan(
          0
        );
      }
    }
  );

  it.each(LOCALES.filter((l): l is Exclude<SupportedLocale, 'en'> => l !== 'en'))(
    '%s.json has the exact same sorted key list as en.json (zero missing, zero extra)',
    (locale) => {
      const localeMessages = loadedLocales[locale].messages;
      const localeKeySet = new Set(Object.keys(localeMessages));
      const enKeySet = new Set(sortedEnKeys);

      const missingKeys = sortedEnKeys.filter((k) => !localeKeySet.has(k));
      const extraKeys = [...localeKeySet].filter((k) => !enKeySet.has(k)).sort();

      expect(missingKeys, `Missing keys in ${locale}.json`).toEqual([]);
      expect(extraKeys, `Extra keys in ${locale}.json`).toEqual([]);
      expect(Object.keys(localeMessages).sort()).toEqual(sortedEnKeys);
    }
  );

  it.each(LOCALES.filter((l): l is Exclude<SupportedLocale, 'en'> => l !== 'en'))(
    '%s.json preserves exact ICU {placeholder} variable names from en.json and formats cleanly in react-intl',
    (locale) => {
      const localeMessages = loadedLocales[locale].messages;
      const placeholderMismatches: Array<{
        key: string;
        expected: string[];
        actual: string[];
      }> = [];

      for (const key of sortedEnKeys) {
        const expectedVars = extractIcuPlaceholders(enMessages[key]);
        const actualVars = extractIcuPlaceholders(localeMessages[key]);
        if (JSON.stringify(expectedVars) !== JSON.stringify(actualVars)) {
          placeholderMismatches.push({
            key,
            expected: expectedVars,
            actual: actualVars,
          });
        }
      }

      expect(placeholderMismatches).toEqual([]);

      // Also verify runtime react-intl formatting succeeds with zero FORMAT_ERRORs
      const formatErrors: string[] = [];
      const intl = createIntl(
        {
          locale,
          messages: localeMessages,
          onError: (err) => {
            const id = 'descriptor' in err ? err.descriptor?.id : undefined;
            formatErrors.push(`${String(id ?? 'unknown')}: ${err.message}`);
          },
        },
        createIntlCache()
      );

      const sampleValues: Record<string, string | number> = {
        count: 5,
        domains: 'youtube.com',
        enabled: 4,
        height: '1.5',
        index: 1,
        label: 'Component',
        latex: 'x^2',
        level: 2,
        limit: 500,
        max: 20,
        min: 1,
        minutes: 3,
        percent: 100,
        time: '0:15',
        total: 10,
        types: 'legacyBlock',
      };

      for (const key of sortedEnKeys) {
        const formatted = intl.formatMessage({ id: key }, sampleValues);
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
      }

      expect(formatErrors).toEqual([]);
    }
  );

  it('formats all en.json messages cleanly in react-intl with zero ICU syntax errors', () => {
    const formatErrors: string[] = [];
    const intl = createIntl(
      {
        locale: 'en',
        messages: enMessages,
        onError: (err) => {
          const id = 'descriptor' in err ? err.descriptor?.id : undefined;
          formatErrors.push(`${String(id ?? 'unknown')}: ${err.message}`);
        },
      },
      createIntlCache()
    );

    const sampleValues: Record<string, string | number> = {
      count: 1,
      domains: 'youtube.com',
      enabled: 4,
      height: '1.5',
      index: 1,
      label: 'Button',
      latex: 'x^2',
      level: 1,
      limit: 500,
      max: 20,
      min: 1,
      minutes: 2,
      percent: 100,
      time: '0:10',
      total: 10,
      types: 'legacyNode',
    };

    for (const key of sortedEnKeys) {
      const formatted = intl.formatMessage({ id: key }, sampleValues);
      expect(formatted.length).toBeGreaterThan(0);
    }

    expect(formatErrors).toEqual([]);
  });

  it('registers every static formatMessage({ id: "tiptap-editor...." }) literal in admin/src/ inside en.json', () => {
    const sourceFiles = collectSourceFiles(ADMIN_SRC_DIR);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const missingKeys: Array<{ file: string; id: string }> = [];
    const discoveredIds = new Set<string>();

    const formatMessageRegex =
      /formatMessage\(\s*\{[^{}]*?\bid\s*:\s*(['"])(tiptap-editor\.[a-zA-Z0-9_.-]+)\1/g;
    const descriptorIdRegex = /\bid\s*:\s*(['"])(tiptap-editor\.[a-zA-Z0-9_.-]+)\1/g;

    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, 'utf8');
      const relativeFile = path.relative(ADMIN_SRC_DIR, filePath);

      for (const regex of [formatMessageRegex, descriptorIdRegex]) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(source)) !== null) {
          const id = match[2];
          discoveredIds.add(id);
          if (!Object.prototype.hasOwnProperty.call(enMessages, id)) {
            missingKeys.push({ file: relativeFile, id });
          }
        }
      }
    }

    expect(discoveredIds.size).toBeGreaterThan(250);
    expect(missingKeys).toEqual([]);
  });
});
