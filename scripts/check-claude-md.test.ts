// scripts/check-claude-md.test.ts
// T-312 — Verifies that CLAUDE.md §6 contains the two P13-specific escalation
// paths added per the v1.17 implementation-plan amendment:
//   1. Compass-source dispute path ("preset matches its compass source").
//   2. Type-design "no adequate fallback" path scoped to clusters A/B/D/F/G.
//
// AC numbers refer to docs/tasks/T-312.md.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const CLAUDE_MD_PATH = resolve(REPO_ROOT, 'CLAUDE.md');

// ---------- helpers ----------

const SECTION_6_HEADING = '## 6. Escalation';
const SECTION_7_HEADING = '## 7. Reference Code';

const REQUIRED_SUBSTRINGS: ReadonlyArray<{ key: string; substring: string }> = [
  { key: 'compass-dispute path', substring: 'preset matches its compass source' },
  { key: 'no-adequate-fallback path', substring: 'no adequate fallback' },
  { key: 'cluster scope reference', substring: 'clusters A/B/D/F/G' },
];

/**
 * Extracts the body of CLAUDE.md §6 (between the §6 heading and the next ## or
 * EOF). Throws if §6 is not present.
 */
function extractSection6(source: string): string {
  const startIdx = source.indexOf(SECTION_6_HEADING);
  if (startIdx === -1) {
    throw new Error(`CLAUDE.md is missing the heading "${SECTION_6_HEADING}"`);
  }
  const afterStart = startIdx + SECTION_6_HEADING.length;
  const nextHeadingIdx = source.indexOf('\n## ', afterStart);
  const endIdx = nextHeadingIdx === -1 ? source.length : nextHeadingIdx;
  return source.slice(startIdx, endIdx);
}

/**
 * Asserts each required substring is present in the §6 body of `source`. Throws
 * a descriptive aggregate error if any are missing — used both by the on-disk
 * check and by the synthetic-mutation test.
 */
function assertSection6Substrings(source: string): void {
  const body = extractSection6(source);
  const missing: string[] = [];
  for (const { key, substring } of REQUIRED_SUBSTRINGS) {
    if (!body.includes(substring)) {
      missing.push(`${key}: ${JSON.stringify(substring)}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `CLAUDE.md §6 is missing required escalation path substring(s):\n  - ${missing.join('\n  - ')}`,
    );
  }
}

const cleanupTargets: string[] = [];
function tracked(path: string): string {
  cleanupTargets.push(path);
  return path;
}
afterEach(() => {
  for (const p of cleanupTargets.splice(0)) {
    rmSync(p, { recursive: true, force: true });
  }
});

// ---------- AC #1 — test exists & runs as part of pnpm test ----------
//
// Implicit: the file's existence + vitest discovery via scripts/vitest.config.ts
// `include: ['*.test.ts']` satisfies AC #1.

// ---------- AC #5 — §6 heading itself exists ----------

describe('T-312 AC #5 — §6 heading', () => {
  it('CLAUDE.md contains the heading "## 6. Escalation"', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    expect(source).toContain(SECTION_6_HEADING);
  });

  it('§6 ends before §7 (sanity: section is bounded)', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const idx6 = source.indexOf(SECTION_6_HEADING);
    const idx7 = source.indexOf(SECTION_7_HEADING);
    expect(idx6).toBeGreaterThan(-1);
    expect(idx7).toBeGreaterThan(idx6);
  });
});

// ---------- AC #2, #3, #4 — required substrings present in §6 ----------

describe('T-312 AC #2, #3, #4 — required escalation-path substrings in §6', () => {
  it('§6 contains "preset matches its compass source" (AC #2)', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const body = extractSection6(source);
    expect(body).toContain('preset matches its compass source');
  });

  it('§6 contains "no adequate fallback" (AC #3)', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const body = extractSection6(source);
    expect(body).toContain('no adequate fallback');
  });

  it('§6 contains "clusters A/B/D/F/G" (AC #4)', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const body = extractSection6(source);
    expect(body).toContain('clusters A/B/D/F/G');
  });

  it('aggregate assertion passes against the on-disk CLAUDE.md', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    expect(() => assertSection6Substrings(source)).not.toThrow();
  });
});

// ---------- AC #6 — synthetic mutation makes the test fail clearly ----------

describe('T-312 AC #6 — synthetic mutation surfaces a clear error', () => {
  it('removing the compass-source line causes a named failure', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const mutated = source.replace('preset matches its compass source', 'REDACTED');
    expect(() => assertSection6Substrings(mutated)).toThrowError(
      /preset matches its compass source/,
    );
    expect(() => assertSection6Substrings(mutated)).toThrowError(/compass-dispute path/);
  });

  it('removing the no-adequate-fallback line causes a named failure', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const mutated = source.replace('no adequate fallback', 'something else');
    expect(() => assertSection6Substrings(mutated)).toThrowError(/no adequate fallback/);
    expect(() => assertSection6Substrings(mutated)).toThrowError(/no-adequate-fallback path/);
  });

  it('removing the cluster-scope reference causes a named failure', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const mutated = source.replace('clusters A/B/D/F/G', 'clusters X/Y/Z');
    expect(() => assertSection6Substrings(mutated)).toThrowError(/clusters A\/B\/D\/F\/G/);
    expect(() => assertSection6Substrings(mutated)).toThrowError(/cluster scope reference/);
  });

  it('removing all three substrings reports all three in one error', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const mutated = source
      .replace('preset matches its compass source', 'X')
      .replace('no adequate fallback', 'Y')
      .replace('clusters A/B/D/F/G', 'Z');
    let err: unknown;
    try {
      assertSection6Substrings(mutated);
    } catch (caught) {
      err = caught;
    }
    expect(err).toBeInstanceOf(Error);
    const msg = (err as Error).message;
    expect(msg).toMatch(/compass-dispute path/);
    expect(msg).toMatch(/no-adequate-fallback path/);
    expect(msg).toMatch(/cluster scope reference/);
  });

  it('exercises the same assertion against a mutated tmp file (end-to-end)', () => {
    const dir = tracked(mkdtempSync(join(tmpdir(), 'tdx-claude-md-')));
    const tmpPath = join(dir, 'CLAUDE.md');
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const mutated = source.replace('preset matches its compass source', 'gone');
    writeFileSync(tmpPath, mutated, 'utf8');
    const reread = readFileSync(tmpPath, 'utf8');
    expect(() => assertSection6Substrings(reread)).toThrowError(/compass-dispute path/);
  });

  it('throws a clear error when §6 itself is missing', () => {
    const source = readFileSync(CLAUDE_MD_PATH, 'utf8');
    const mutated = source.replace(SECTION_6_HEADING, '## 6X. Renamed Section');
    expect(() => extractSection6(mutated)).toThrowError(/missing the heading/);
  });
});

// ---------- AC #7 — backward compat is implicit (no other source files modified) ----------
