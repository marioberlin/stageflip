// packages/on-device-player-ops/src/determinism-scan.test.ts
// Source-level scan: although this package is OUTSIDE the CLAUDE.md §3
// determinism perimeter (the perimeter targets clip code under
// `packages/runtimes/*/src/clips/**`), the ops + telemetry surface is
// still pure-by-discipline: no `Date.now`, no `Math.random`, no
// `setTimeout`/`setInterval`, no `fetch`/`XMLHttpRequest`. Clocks come
// in via the caller-injected `clock: () => number` argument.
//
// Mirrors the T-399 / T-400 determinism-scan block.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

const SOURCE_FILES = [
  'metrics.ts',
  'recorder.ts',
  'health-endpoint.ts',
  'fleet-rollup.ts',
  'ops-event-sink.ts',
  'index.ts',
];

const FORBIDDEN = [
  'Date.now',
  'new Date(',
  'Date()',
  'performance.now',
  'Math.random',
  'XMLHttpRequest',
  'navigator.sendBeacon',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'new Worker(',
  'SharedWorker',
];

describe('source-level determinism scan', () => {
  it('ops modules contain no forbidden non-deterministic API references', () => {
    for (const file of SOURCE_FILES) {
      const src = readFileSync(join(HERE, file), 'utf-8');
      // Strip block + line comments and string literals so a comment or
      // an error message that names a forbidden API does not trip the
      // scan. Real call sites remain visible.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
      for (const needle of FORBIDDEN) {
        expect(stripped, `${file} references ${needle}`).not.toContain(needle);
      }
    }
  });
});
