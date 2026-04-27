// packages/import-hyperframes-html/src/determinism.test.ts
// AC #33: source-level grep test mirroring T-253-base AC #28 + T-245 AC #19.
// `packages/import-hyperframes-html/src/**` must not call any of the banned
// non-deterministic primitives. Comments and `// determinism-safe:` markers
// are stripped before scanning.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));

const BANNED = [
  // Non-deterministic time / random APIs.
  /\bDate\.now\b/,
  /\bnew\s+Date\(\)/,
  /\bperformance\.now\b/,
  /\bMath\.random\b/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...listSourceFiles(p));
    } else if (s.isFile() && (p.endsWith('.ts') || p.endsWith('.tsx'))) {
      // Test files exercise the importer with arbitrary inputs; spec scopes
      // the determinism gate to runtime source only.
      if (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) continue;
      out.push(p);
    }
  }
  return out;
}

function stripComments(src: string): string {
  // Remove /* ... */ comments (incl. multiline) and // ... line comments.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, prefix: string) => prefix);
}

describe('AC #33: source-level determinism', () => {
  it('no banned primitives in src/**', () => {
    const files = listSourceFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const stripped = stripComments(raw);
      for (const pattern of BANNED) {
        if (pattern.test(stripped)) {
          violations.push(`${relative(SRC_DIR, file)}: matches ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
