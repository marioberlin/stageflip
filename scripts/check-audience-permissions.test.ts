// scripts/check-audience-permissions.test.ts
// T-455 — vitest suite for `check-audience-permissions`. Drives the pure
// `runCheck()` core against an in-tmpdir fake `clips/` tree per test
// case, asserts exit code + failure verdicts. Mirrors the test-fixture
// shape used by `check-adapter-regression.test.ts` (T-435).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  classifyClip,
  extractManifestBody,
  extractPermissions,
  formatReport,
  parseStringTuple,
  runCheck,
} from './check-audience-permissions.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'check-audience-permissions-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeClip(clipKind: string, contents: string, file = 'manifest.ts'): string {
  const clipDir = join(dir, clipKind);
  mkdirSync(clipDir, { recursive: true });
  const path = join(clipDir, file);
  writeFileSync(path, contents, 'utf8');
  return path;
}

const VALID_MANIFEST = `// header
import type { AudienceClipManifest } from '@stageflip/runtimes-audience';
export const MANIFEST: AudienceClipManifest = {
  kind: 'live-poll-multiple-choice',
  permissions: ['audience-network'],
};
`;

describe('runCheck — top-level integration', () => {
  it('passes on inaugural empty clips/ directory', () => {
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
    expect(result.clipsInspected).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('passes when clipsDir does not exist (defensive — same as empty)', () => {
    const result = runCheck({ clipsDir: join(dir, 'does-not-exist') });
    expect(result.exitCode).toBe(0);
    expect(result.clipsInspected).toBe(0);
  });

  it('ignores dotfiles (e.g. .gitkeep) when discovering clips', () => {
    writeFileSync(join(dir, '.gitkeep'), '', 'utf8');
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
    expect(result.clipsInspected).toBe(0);
  });

  it('ignores non-directory entries under clips/', () => {
    writeFileSync(join(dir, 'README.md'), '# notes', 'utf8');
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
    expect(result.clipsInspected).toBe(0);
  });

  it('passes a clip with a valid manifest.ts', () => {
    writeClip('live-poll-multiple-choice', VALID_MANIFEST);
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
    expect(result.clipsInspected).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it('falls back to index.ts when manifest.ts is absent', () => {
    writeClip('live-poll-multiple-choice', VALID_MANIFEST, 'index.ts');
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('prefers manifest.ts over index.ts when both exist', () => {
    writeClip('word-cloud', VALID_MANIFEST, 'manifest.ts');
    // index.ts has a broken manifest — but manifest.ts wins, so PASS.
    writeFileSync(
      join(dir, 'word-cloud', 'index.ts'),
      `export const MANIFEST = { permissions: ['network'] };`,
      'utf8',
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
  });

  it('fails MISSING-MANIFEST when neither manifest.ts nor index.ts exist', () => {
    mkdirSync(join(dir, 'lone-clip'), { recursive: true });
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures).toHaveLength(1);
    const failure = result.failures[0];
    expect(failure?.clipKind).toBe('lone-clip');
    expect(failure?.verdict).toBe('missing-manifest');
    expect(failure?.source).toBeUndefined();
  });

  it('fails MISSING-MANIFEST when source has no `MANIFEST` export', () => {
    writeClip('no-export', `export const NOT_MANIFEST = { permissions: ['audience-network'] };`);
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures[0]?.verdict).toBe('missing-manifest');
  });

  it("fails WRONG-PERMISSIONS when permissions is `['network']`", () => {
    writeClip(
      'wrong-perm',
      `export const MANIFEST: AudienceClipManifest = {
         kind: 'live-poll-multiple-choice',
         permissions: ['network'],
       };`,
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures[0]?.verdict).toBe('wrong-permissions');
  });

  it('fails EXTRA-PERMISSIONS when permissions has audience-network + extras', () => {
    writeClip(
      'extra-perm',
      `export const MANIFEST: AudienceClipManifest = {
         kind: 'audience-ai-prompt',
         permissions: ['audience-network', 'microphone'],
       };`,
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures[0]?.verdict).toBe('extra-permissions');
  });

  it('fails NON-LITERAL when permissions is a function-call expression', () => {
    writeClip(
      'non-literal',
      `export const MANIFEST: AudienceClipManifest = {
         kind: 'live-poll-multiple-choice',
         permissions: computeArray(),
       };`,
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures[0]?.verdict).toBe('non-literal');
  });

  it('fails NON-LITERAL when permissions is an identifier reference', () => {
    writeClip(
      'identifier-ref',
      `const PERMS = ['audience-network'];
       export const MANIFEST: AudienceClipManifest = {
         kind: 'live-poll-multiple-choice',
         permissions: PERMS,
       };`,
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures[0]?.verdict).toBe('non-literal');
  });

  it('fails MISSING-PERMISSIONS-KEY when MANIFEST has no permissions field', () => {
    writeClip(
      'no-perm-key',
      `export const MANIFEST: AudienceClipManifest = {
         kind: 'live-poll-multiple-choice',
       };`,
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.failures[0]?.verdict).toBe('missing-permissions-key');
  });

  it('reports every failure across multiple bad clips', () => {
    writeClip('clip-a', VALID_MANIFEST);
    writeClip(
      'clip-b',
      `export const MANIFEST: AudienceClipManifest = {
         kind: 'live-qa',
         permissions: ['network'],
       };`,
    );
    mkdirSync(join(dir, 'clip-c'), { recursive: true });
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(1);
    expect(result.clipsInspected).toBe(3);
    expect(result.failures).toHaveLength(2);
    const verdicts = result.failures.map((f) => f.verdict).sort();
    expect(verdicts).toEqual(['missing-manifest', 'wrong-permissions']);
  });

  it('accepts permissions tuple with surrounding whitespace + trailing comma', () => {
    writeClip(
      'whitespacey',
      `export const MANIFEST : AudienceClipManifest = {
         kind: 'live-poll-multiple-choice',
         permissions: [ 'audience-network' , ],
       };`,
    );
    const result = runCheck({ clipsDir: dir });
    expect(result.exitCode).toBe(0);
  });
});

describe('extractManifestBody', () => {
  it('returns undefined when no MANIFEST export is present', () => {
    expect(extractManifestBody('export const X = { foo: 1 };')).toBeUndefined();
  });

  it('captures the object-literal body including nested braces', () => {
    const src = `export const MANIFEST = { a: 1, b: { c: 2 } };`;
    const body = extractManifestBody(src);
    expect(body).toBeDefined();
    expect(body).toContain('a: 1');
    expect(body).toContain('b: { c: 2 }');
  });

  it('handles string literals containing braces without breaking depth count', () => {
    const src = `export const MANIFEST = { msg: "}", n: 1 };`;
    const body = extractManifestBody(src);
    expect(body).toBeDefined();
    expect(body).toContain('msg: "}"');
    expect(body).toContain('n: 1');
  });

  it('handles escape sequences inside string literals', () => {
    const src = `export const MANIFEST = { s: "a\\"b", n: 1 };`;
    const body = extractManifestBody(src);
    expect(body).toBeDefined();
    expect(body).toContain('n: 1');
  });

  it('returns undefined if the brace is never closed', () => {
    const src = `export const MANIFEST = { a: 1`;
    expect(extractManifestBody(src)).toBeUndefined();
  });
});

describe('extractPermissions', () => {
  it('returns missing when permissions key is absent', () => {
    expect(extractPermissions(`kind: 'x'`).kind).toBe('missing');
  });

  it('returns literal with entries on a string-tuple RHS', () => {
    const r = extractPermissions(`permissions: ['audience-network']`);
    expect(r.kind).toBe('literal');
    if (r.kind === 'literal') {
      expect(r.entries).toEqual(['audience-network']);
    }
  });

  it('returns non-literal when permissions RHS is not bracketed', () => {
    expect(extractPermissions(`permissions: foo()`).kind).toBe('non-literal');
  });

  it('returns non-literal when bracketed array has non-string elements', () => {
    expect(extractPermissions(`permissions: [foo]`).kind).toBe('non-literal');
  });
});

describe('parseStringTuple', () => {
  it('returns empty list on empty input', () => {
    expect(parseStringTuple('')).toEqual([]);
    expect(parseStringTuple('   ')).toEqual([]);
  });

  it('parses single- and double-quoted entries', () => {
    expect(parseStringTuple(`'a', "b"`)).toEqual(['a', 'b']);
  });

  it('tolerates trailing comma', () => {
    expect(parseStringTuple(`'a',`)).toEqual(['a']);
  });

  it('returns undefined when an entry is not a string literal', () => {
    expect(parseStringTuple(`'a', identifier`)).toBeUndefined();
  });

  it('handles escape sequences inside string entries', () => {
    expect(parseStringTuple(`'a\\'b'`)).toEqual([`a\\'b`]);
  });
});

describe('classifyClip', () => {
  it('returns missing-manifest when sourcePath is undefined', () => {
    const f = classifyClip({ clipKind: 'x', sourcePath: undefined, source: undefined });
    expect(f?.verdict).toBe('missing-manifest');
  });
});

describe('formatReport', () => {
  it('renders the inaugural empty-clips message', () => {
    const out = formatReport({ clipsInspected: 0, failures: [], exitCode: 0 });
    expect(out).toContain('0 audience clips registered');
    expect(out).toContain('PASS');
  });

  it('renders singular `clip inspected` when count is 1', () => {
    const out = formatReport({ clipsInspected: 1, failures: [], exitCode: 0 });
    expect(out).toContain('1 audience clip inspected');
  });

  it('renders plural `clips inspected` when count > 1', () => {
    const out = formatReport({ clipsInspected: 3, failures: [], exitCode: 0 });
    expect(out).toContain('3 audience clips inspected');
  });

  it('renders FAIL footer + per-failure detail on failure', () => {
    const out = formatReport({
      clipsInspected: 1,
      failures: [
        {
          clipKind: 'bad-clip',
          verdict: 'wrong-permissions',
          source: '/tmp/bad-clip/manifest.ts',
          detail: 'wrong array',
        },
      ],
      exitCode: 1,
    });
    expect(out).toContain('FAIL');
    expect(out).toContain('bad-clip');
    expect(out).toContain('wrong-permissions');
    expect(out).toContain('wrong array');
  });

  it('renders `(no source)` placeholder when source is undefined', () => {
    const out = formatReport({
      clipsInspected: 1,
      failures: [
        {
          clipKind: 'no-src',
          verdict: 'missing-manifest',
          source: undefined,
          detail: 'no files',
        },
      ],
      exitCode: 1,
    });
    expect(out).toContain('(no source)');
  });
});
