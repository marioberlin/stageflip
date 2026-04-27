// packages/design-system/src/determinism.test.ts
// AC #30: source-level grep test mirroring T-253-base AC #28 / T-245 AC #19 /
// T-247 AC #33 / T-246 AC #29. Banned non-deterministic primitives must
// not appear in `packages/design-system/src/**` (excluding tests +
// `// determinism-safe:` markers).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));

const BANNED = [
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
      if (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) continue;
      // Test-helpers + stub-fetcher are wired into tests only; technically
      // they are runtime files but they don't ship in the public surface
      // for production callers. Keep them in scope to be conservative —
      // they should not need any banned primitive either.
      out.push(p);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, prefix: string) => prefix);
}

describe('AC #30: source-level determinism', () => {
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
