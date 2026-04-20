// scripts/check-remotion-imports.ts
// CI gate for invariant I-6 (CLAUDE.md §3, architecture §2): zero imports of
// `remotion` or `@remotion/*` anywhere in workspace source. Any match is an
// immediate gate failure. Matches import, require, and dynamic-import forms
// by looking for the package name inside a quoted module specifier.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Matches any quoted "remotion" or "@remotion/…" module specifier. */
const REMOTION_REGEX = /['"`](remotion|@remotion\/[^'"`]+)['"`]/;

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.git',
  'coverage',
  'test-results',
  'playwright-report',
  'reference',
  '.changeset',
  '.claude',
]);

const ROOT = resolve(process.cwd());
const SELF = fileURLToPath(import.meta.url);

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.');
      if (dot === -1) continue;
      const ext = entry.name.slice(dot);
      if (!SOURCE_EXTS.has(ext)) continue;
      yield full;
    }
  }
}

type Hit = { file: string; line: number; text: string };

async function scan(file: string): Promise<Hit[]> {
  const content = await readFile(file, 'utf8');
  const hits: Hit[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (REMOTION_REGEX.test(line)) {
      hits.push({ file, line: i + 1, text: line.trim() });
    }
  }
  return hits;
}

async function main(): Promise<void> {
  const all: Hit[] = [];
  let fileCount = 0;

  for await (const file of walk(ROOT)) {
    // Never scan this script — it contains "@remotion/" as a regex string.
    if (resolve(file) === SELF) continue;
    // Also skip the scripts dir to avoid self-reference in other gates.
    const rel = relative(ROOT, file);
    if (rel.split(sep)[0] === 'scripts') continue;
    fileCount += 1;
    const hits = await scan(file);
    all.push(...hits);
  }

  process.stdout.write(
    `check-remotion-imports: scanned ${fileCount} source files\n`,
  );

  if (all.length === 0) {
    process.stdout.write('check-remotion-imports: PASS\n');
    process.exit(0);
  }

  process.stderr.write(`\n  MATCHES (${all.length}):\n`);
  for (const h of all) {
    const rel = relative(ROOT, h.file);
    process.stderr.write(`    ${rel}:${h.line}  ${h.text}\n`);
  }
  process.stderr.write(
    '\ncheck-remotion-imports: FAIL — invariant I-6 forbids any import from `remotion` or `@remotion/*`.\n',
  );
  process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(`check-remotion-imports: crashed: ${String(err)}\n`);
  process.exit(2);
});
