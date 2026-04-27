// packages/import-google-slides/src/aiqc/determinism.test.ts
// AC #29: source-level grep test pinning that src/aiqc/** does not call
// Date.now / new Date() / Math.random / performance.now / setTimeout /
// setInterval. Mirrors T-253-base AC #28, T-245 AC #19, T-247 AC #33.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AIQC_DIR = __dirname;

function* walk(dir: string): IterableIterator<string> {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) {
      yield full;
    }
  }
}

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Date.now', pattern: /\bDate\.now\b/ },
  // new Date() (no args) only — `new Date(arg)` is permitted (parsing).
  { name: 'new Date()', pattern: /\bnew\s+Date\s*\(\s*\)/ },
  { name: 'Math.random', pattern: /\bMath\.random\b/ },
  { name: 'performance.now', pattern: /\bperformance\.now\b/ },
  { name: 'setTimeout', pattern: /\bsetTimeout\s*\(/ },
  { name: 'setInterval', pattern: /\bsetInterval\s*\(/ },
];

describe('AC #29: source-level discipline (no time/random/timer calls in src/aiqc/**)', () => {
  it('every source file is forbidden-pattern free', () => {
    const offenders: string[] = [];
    for (const file of walk(AIQC_DIR)) {
      const src = readFileSync(file, 'utf8');
      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(src)) {
          offenders.push(`${file}: ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
