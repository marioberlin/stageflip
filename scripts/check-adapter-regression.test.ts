// scripts/check-adapter-regression.test.ts
// Unit tests for the T-435 check-adapter-regression CI gate. Drives the
// pure runRegressions() core against an in-tmpdir snapshots directory
// populated by the regen module.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ADAPTER_IDS, type AdapterId } from '../packages/adapter-regression/src/index.js';
import { buildSnapshotFor } from './regenerate-adapter-regression-snapshots.js';
import {
  formatReport,
  readSnapshot,
  runRegressions,
  snapshotPathFor,
} from './check-adapter-regression.js';

describe('snapshotPathFor', () => {
  it('joins snapshotsDir + adapter id + .json', () => {
    expect(snapshotPathFor('/snap', 'kokoro')).toBe('/snap/kokoro.json');
  });
});

describe('readSnapshot', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'adapter-regression-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns missing when the file does not exist', () => {
    const res = readSnapshot(dir, 'kokoro');
    expect(res.kind).toBe('missing');
  });

  it('returns parse-error on invalid JSON', () => {
    writeFileSync(join(dir, 'kokoro.json'), 'not-json', 'utf8');
    const res = readSnapshot(dir, 'kokoro');
    expect(res.kind).toBe('parse-error');
    if (res.kind !== 'parse-error') return;
    expect(res.cause).toContain('JSON.parse');
  });

  it('returns parse-error on malformed shape', () => {
    writeFileSync(join(dir, 'kokoro.json'), JSON.stringify({ id: 'kokoro' }), 'utf8');
    const res = readSnapshot(dir, 'kokoro');
    expect(res.kind).toBe('parse-error');
  });
});

describe('runRegressions', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'adapter-regression-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function writeFreshSnapshot(adapterId: AdapterId): Promise<void> {
    const snapshot = await buildSnapshotFor(adapterId);
    writeFileSync(join(dir, `${adapterId}.json`), JSON.stringify(snapshot, null, 2), 'utf8');
  }

  it('reports MISSING-SNAPSHOT when files are absent (one adapter subset)', async () => {
    const report = await runRegressions(dir, ['kokoro']);
    expect(report.missingSnapshots).toEqual(['kokoro']);
    expect(report.exitCode).toBe(1);
  });

  it('reports OK when the snapshot is freshly generated (kokoro)', async () => {
    await writeFreshSnapshot('kokoro');
    const report = await runRegressions(dir, ['kokoro']);
    expect(report.exitCode).toBe(0);
    expect(report.verdicts.get('kokoro')?.ok).toBe(true);
  });

  it('reports drift when a snapshot cacheKey is mutated', async () => {
    const snapshot = await buildSnapshotFor('kokoro');
    const mutated = {
      ...snapshot,
      sampleInputs: [{ ...snapshot.sampleInputs[0]!, cacheKey: 'tts/wrong' }],
    };
    writeFileSync(join(dir, 'kokoro.json'), JSON.stringify(mutated, null, 2), 'utf8');
    const report = await runRegressions(dir, ['kokoro']);
    expect(report.exitCode).toBe(1);
    const verdict = report.verdicts.get('kokoro');
    expect(verdict?.ok).toBe(false);
    if (!verdict || verdict.ok) return;
    expect(verdict.sampleDrifts.length).toBeGreaterThan(0);
  });

  it('reports drift when a snapshot descriptorSha256 is mutated', async () => {
    const snapshot = await buildSnapshotFor('kokoro');
    const mutated = { ...snapshot, descriptorSha256: 'a'.repeat(64) };
    writeFileSync(join(dir, 'kokoro.json'), JSON.stringify(mutated, null, 2), 'utf8');
    const report = await runRegressions(dir, ['kokoro']);
    expect(report.exitCode).toBe(1);
    const verdict = report.verdicts.get('kokoro');
    expect(verdict?.ok).toBe(false);
    if (!verdict || verdict.ok) return;
    expect(verdict.descriptorDrift).toBeDefined();
  });
});

describe('formatReport', () => {
  it('formats PASS', () => {
    const out = formatReport({
      adaptersInspected: 9,
      verdicts: new Map(),
      missingSnapshots: [],
      snapshotParseErrors: [],
      exitCode: 0,
    });
    expect(out).toContain('PASS');
    expect(out).toContain('inspected 9 adapters');
  });

  it('formats FAIL with MISSING-SNAPSHOT', () => {
    const out = formatReport({
      adaptersInspected: 9,
      verdicts: new Map(),
      missingSnapshots: ['kokoro'],
      snapshotParseErrors: [],
      exitCode: 1,
    });
    expect(out).toContain('FAIL');
    expect(out).toContain('MISSING-SNAPSHOT');
    expect(out).toContain('kokoro');
  });

  it('formats FAIL with PARSE-ERROR', () => {
    const out = formatReport({
      adaptersInspected: 9,
      verdicts: new Map(),
      missingSnapshots: [],
      snapshotParseErrors: [{ adapterId: 'yue', cause: 'oops' }],
      exitCode: 1,
    });
    expect(out).toContain('PARSE-ERROR');
    expect(out).toContain('yue');
    expect(out).toContain('oops');
  });
});

describe('ADAPTER_IDS coverage', () => {
  it('exports 9 adapter ids', () => {
    expect(ADAPTER_IDS).toHaveLength(9);
  });
});
