// packages/observability/src/sourcemap-upload.test.ts
// T-264 ACs #16, #17, #18 — sourcemap-upload script: arg parsing, dry-run,
// missing-arg error path. The script at `scripts/sentry-upload-sourcemaps.ts`
// is a thin shim around this module's `run`.

import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { buildSentryCliArgs, parseArgs, run, validateArgs } from './sourcemap-upload.js';

interface CollectingStream extends Writable {
  collected: string;
}

function makeStream(): CollectingStream {
  const s = new Writable({
    write(chunk, _enc, cb): void {
      (s as CollectingStream).collected += chunk.toString();
      cb();
    },
  }) as CollectingStream;
  s.collected = '';
  return s;
}

describe('parseArgs', () => {
  it('parses --key=value pairs', () => {
    const a = parseArgs(['--release=sha-abc', '--org=acme', '--project=stageflip', '--path=dist']);
    expect(a.release).toBe('sha-abc');
    expect(a.org).toBe('acme');
    expect(a.project).toBe('stageflip');
    expect(a.path).toBe('dist');
    expect(a.dryRun).toBe(false);
  });

  it('parses --dry-run flag', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
  });

  it('parses --help', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('ignores unknown --flag=value pairs without crashing', () => {
    const a = parseArgs(['--unknown=v']);
    expect(a.release).toBeUndefined();
  });

  it('ignores positional args', () => {
    expect(parseArgs(['plain-arg']).help).toBe(false);
  });
});

describe('validateArgs (AC #18)', () => {
  it('reports all missing required args', () => {
    const missing = validateArgs(parseArgs([]));
    expect(missing).toEqual(['--release', '--org', '--project', '--path']);
  });

  it('passes when all required args are present', () => {
    expect(validateArgs(parseArgs(['--release=x', '--org=y', '--project=z', '--path=p']))).toEqual(
      [],
    );
  });
});

describe('buildSentryCliArgs (AC #16)', () => {
  it('produces the documented sentry-cli sourcemaps upload invocation', () => {
    const cli = buildSentryCliArgs({
      release: 'sha-abc',
      org: 'acme',
      project: 'stageflip',
      path: 'dist',
    });
    expect([...cli]).toEqual([
      'sourcemaps',
      'upload',
      '--org',
      'acme',
      '--project',
      'stageflip',
      '--release',
      'sha-abc',
      'dist',
    ]);
  });
});

describe('run (AC #17, #18)', () => {
  it('AC #17: dry-run prints command and returns 0 without invoking sentry-cli', () => {
    const out = makeStream();
    const err = makeStream();
    const invoke = vi.fn();
    const code = run(['--release=x', '--org=y', '--project=z', '--path=p', '--dry-run'], {
      out,
      err,
      invoke,
    });
    expect(code).toBe(0);
    expect(out.collected).toContain('[dry-run] sentry-cli');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('AC #18: missing args → exit 1, usage printed to stderr', () => {
    const out = makeStream();
    const err = makeStream();
    const code = run([], { out, err, invoke: vi.fn() });
    expect(code).toBe(1);
    expect(err.collected).toContain('missing required args');
    expect(err.collected).toContain('Usage:');
  });

  it('AC #16: real invocation — passes through the constructed CLI args', () => {
    const out = makeStream();
    const err = makeStream();
    const invoke = vi.fn(() => ({ status: 0 }));
    const code = run(['--release=sha-abc', '--org=acme', '--project=stageflip', '--path=dist'], {
      out,
      err,
      invoke,
    });
    expect(code).toBe(0);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('sentry-cli', [
      'sourcemaps',
      'upload',
      '--org',
      'acme',
      '--project',
      'stageflip',
      '--release',
      'sha-abc',
      'dist',
    ]);
  });

  it('AC #16: surfaces non-zero status from sentry-cli', () => {
    const out = makeStream();
    const err = makeStream();
    const invoke = vi.fn(() => ({ status: 7 }));
    const code = run(['--release=x', '--org=y', '--project=z', '--path=p'], { out, err, invoke });
    expect(code).toBe(7);
  });

  it('AC #16: maps null status (e.g. signal-killed) to exit code 1', () => {
    const out = makeStream();
    const err = makeStream();
    const invoke = vi.fn(() => ({ status: null }));
    const code = run(['--release=x', '--org=y', '--project=z', '--path=p'], { out, err, invoke });
    expect(code).toBe(1);
  });

  it('--help prints usage and returns 0', () => {
    const out = makeStream();
    const err = makeStream();
    const code = run(['--help'], { out, err, invoke: vi.fn() });
    expect(code).toBe(0);
    expect(out.collected).toContain('Usage:');
  });
});
