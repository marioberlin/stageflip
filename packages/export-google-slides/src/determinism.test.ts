// packages/export-google-slides/src/determinism.test.ts
// AC #28: source-level determinism discipline. The package is not in the
// determinism-restricted scope (per CLAUDE.md §3 the scope is
// `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, and
// `packages/renderer-core/src/clips/**`), but the spec pins a grep test so
// the export pipeline doesn't accidentally introduce non-determinism.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname);
// Patterns AC #28 forbids inside `packages/export-google-slides/src/**`.
const FORBIDDEN: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bDate\.now\b/, name: 'Date.now' },
  { pattern: /\bMath\.random\b/, name: 'Math.random' },
  { pattern: /\bperformance\.now\b/, name: 'performance.now' },
  { pattern: /\bsetTimeout\s*\(/, name: 'setTimeout' },
  { pattern: /\bsetInterval\s*\(/, name: 'setInterval' },
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
      continue;
    }
    if (!full.endsWith('.ts')) continue;
    // Skip tests (the test layer is allowed to use any timing primitive).
    // The grep is the source layer's discipline. Test helpers live outside
    // `src/` (in `test-helpers/`) so they aren't reached at all.
    if (full.endsWith('.test.ts')) continue;
    out.push(full);
  }
  return out;
}

describe('AC #28: source-level determinism', () => {
  it('packages/export-google-slides/src/** uses no Date.now / Math.random / performance.now / setTimeout / setInterval', () => {
    const files = listSourceFiles(SRC_ROOT);
    const violations: Array<{ file: string; pattern: string; line: number; text: string }> = [];
    for (const filePath of files) {
      const txt = readFileSync(filePath, 'utf8');
      const lines = txt.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        // Allow the literal pattern only inside a comment (e.g. this file's
        // own description of the rule). Comments dominate the line if the
        // first non-whitespace chars are `//` or part of a block comment.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }
        for (const forbidden of FORBIDDEN) {
          if (forbidden.pattern.test(line)) {
            violations.push({
              file: relative(SRC_ROOT, filePath),
              pattern: forbidden.name,
              line: i + 1,
              text: line.trim(),
            });
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
