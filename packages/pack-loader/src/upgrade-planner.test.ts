// packages/pack-loader/src/upgrade-planner.test.ts
// T-540 — Pure-function tests for the upgrade planner. No filesystem;
// every input is a synthetic `PackManifest` literal.

import type { PackManifest } from '@stageflip/pack-format';
import { describe, expect, it } from 'vitest';

import {
  type CataloguePackVersion,
  type UpgradePlanInput,
  catalogueKey,
  planUpgrade,
} from './upgrade-planner.js';

function manifest(opts: {
  readonly publisher?: string;
  readonly id?: string;
  readonly version?: string;
  readonly platformCompatibility?: string;
  readonly manifestVersion?: string;
}): PackManifest {
  // Cast through `unknown` so tests can supply a hypothetical
  // `manifestVersion: '99'` outside the schema literal `'1'`.
  return {
    manifestVersion: opts.manifestVersion ?? '1',
    id: opts.id ?? 'pack-a',
    name: opts.id ?? 'pack-a',
    version: opts.version ?? '1.0.0',
    publisher: {
      id: opts.publisher ?? 'pub-1',
      displayName: opts.publisher ?? 'pub-1',
    },
    platformCompatibility: opts.platformCompatibility ?? '^2.0.0',
    license: { kind: 'open', spdx: 'MIT' },
    integrity: { algorithm: 'sha256', hash: 'a'.repeat(64) },
    contributes: {},
  } as unknown as PackManifest;
}

function installed(m: PackManifest): UpgradePlanInput['installed'][number] {
  return { manifest: m, installPath: `/tmp/${m.publisher.id}/${m.id}/${m.version}` };
}

describe('planUpgrade', () => {
  it('returns an empty plan for an empty installed list', () => {
    const plan = planUpgrade({ installed: [], targetEngineVersion: '2.5.0' });
    expect(plan.rows).toEqual([]);
    expect(plan.summary).toEqual({
      compatible: 0,
      needsUpgrade: 0,
      blocked: 0,
      manifestVersionIncompatible: 0,
    });
    expect(plan.targetEngineVersion).toBe('2.5.0');
  });

  it('marks a pack as compatible when platformCompatibility admits the target', () => {
    const m = manifest({ platformCompatibility: '^2.0.0' });
    const plan = planUpgrade({ installed: [installed(m)], targetEngineVersion: '2.5.0' });
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]?.status).toBe('compatible');
    expect(plan.summary.compatible).toBe(1);
  });

  it('marks a pack as blocked when incompatible and no catalogue is supplied', () => {
    const m = manifest({ platformCompatibility: '^2.0.0' });
    const plan = planUpgrade({ installed: [installed(m)], targetEngineVersion: '3.0.0' });
    // ^2.0.0 means major=2 only, so 3.0.0 doesn't satisfy.
    // But 3.0.0 still reads manifestVersion 1 (matrix row >=2.0.0).
    expect(plan.rows[0]?.status).toBe('blocked');
    expect(plan.summary.blocked).toBe(1);
  });

  it('marks a pack as needs-upgrade when a newer compatible version is in the catalogue', () => {
    const m = manifest({ version: '0.2.0', platformCompatibility: '^2.0.0' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'pack-a'),
        [{ version: '0.3.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' }],
      ],
    ]);
    const plan = planUpgrade({
      installed: [installed(m)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    expect(plan.rows[0]?.status).toBe('needs-upgrade');
    expect(plan.rows[0]?.recommendedAction).toContain('0.3.0');
    expect(plan.summary.needsUpgrade).toBe(1);
  });

  it('marks a pack as blocked when only older/incompatible catalogue entries exist', () => {
    const m = manifest({ version: '0.2.0', platformCompatibility: '^2.0.0' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'pack-a'),
        [
          // Older version — ignored.
          { version: '0.1.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
          // Newer but still pinned to v2 — doesn't help.
          { version: '0.3.0', platformCompatibility: '^2.0.0', manifestVersion: '1' },
        ],
      ],
    ]);
    const plan = planUpgrade({
      installed: [installed(m)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    expect(plan.rows[0]?.status).toBe('blocked');
  });

  it('marks manifest-version-incompatible when target engine does not read that manifestVersion', () => {
    const m = manifest({ manifestVersion: '99' });
    const plan = planUpgrade({ installed: [installed(m)], targetEngineVersion: '2.5.0' });
    expect(plan.rows[0]?.status).toBe('manifest-version-incompatible');
    expect(plan.summary.manifestVersionIncompatible).toBe(1);
  });

  it('manifest-version-incompatible short-circuits before compatibility check', () => {
    // platformCompatibility would otherwise admit; but mv 99 isn't readable.
    const m = manifest({ manifestVersion: '99', platformCompatibility: '>=0.0.0' });
    const plan = planUpgrade({ installed: [installed(m)], targetEngineVersion: '2.5.0' });
    expect(plan.rows[0]?.status).toBe('manifest-version-incompatible');
  });

  it('aggregates a 3.0.0-upgrade scenario into all four statuses', () => {
    const compat = manifest({ id: 'a', platformCompatibility: '>=2.0.0' });
    const needs = manifest({ id: 'b', version: '0.2.0', platformCompatibility: '^2.0.0' });
    const blocked = manifest({ id: 'c', platformCompatibility: '^2.0.0' });
    const mvBad = manifest({ id: 'd', manifestVersion: '99' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'b'),
        [{ version: '0.3.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' }],
      ],
      // c has no entry → blocked
    ]);
    const plan = planUpgrade({
      installed: [installed(compat), installed(needs), installed(blocked), installed(mvBad)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    expect(plan.summary.compatible).toBe(1);
    expect(plan.summary.needsUpgrade).toBe(1);
    expect(plan.summary.blocked).toBe(1);
    expect(plan.summary.manifestVersionIncompatible).toBe(1);
  });

  it('treats a missing catalogue entry as blocked rather than crashing', () => {
    const m = manifest({ platformCompatibility: '^2.0.0' });
    const plan = planUpgrade({
      installed: [installed(m)],
      targetEngineVersion: '3.0.0',
      catalogue: new Map(),
    });
    expect(plan.rows[0]?.status).toBe('blocked');
  });

  it('recommendedAction strings are non-empty for every status', () => {
    const compat = manifest({ id: 'a', platformCompatibility: '^2.0.0' });
    const needs = manifest({ id: 'b', version: '0.2.0', platformCompatibility: '^2.0.0' });
    const blocked = manifest({ id: 'c', platformCompatibility: '^2.0.0' });
    const mvBad = manifest({ id: 'd', manifestVersion: '99' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'b'),
        [{ version: '0.3.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' }],
      ],
    ]);
    const plan = planUpgrade({
      installed: [installed(compat), installed(needs), installed(blocked), installed(mvBad)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    for (const row of plan.rows) {
      expect(row.recommendedAction.length).toBeGreaterThan(0);
    }
  });

  it('picks the highest compatible catalogue version when several qualify', () => {
    const m = manifest({ version: '0.2.0', platformCompatibility: '^2.0.0' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'pack-a'),
        [
          { version: '0.3.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
          { version: '0.5.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
          { version: '0.4.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
        ],
      ],
    ]);
    const plan = planUpgrade({
      installed: [installed(m)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    expect(plan.rows[0]?.status).toBe('needs-upgrade');
    expect(plan.rows[0]?.recommendedAction).toContain('0.5.0');
  });

  it('ignores catalogue versions whose manifestVersion is not readable by the target', () => {
    const m = manifest({ version: '0.2.0', platformCompatibility: '^2.0.0' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'pack-a'),
        [
          { version: '0.9.0', platformCompatibility: '>=2.0.0', manifestVersion: '99' },
          { version: '0.3.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
        ],
      ],
    ]);
    const plan = planUpgrade({
      installed: [installed(m)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    expect(plan.rows[0]?.status).toBe('needs-upgrade');
    expect(plan.rows[0]?.recommendedAction).toContain('0.3.0');
  });

  it('ignores catalogue entries older than or equal to the installed version', () => {
    const m = manifest({ version: '0.5.0', platformCompatibility: '^2.0.0' });
    const catalogue = new Map<string, readonly CataloguePackVersion[]>([
      [
        catalogueKey('pub-1', 'pack-a'),
        [
          { version: '0.5.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
          { version: '0.4.0', platformCompatibility: '>=2.0.0', manifestVersion: '1' },
        ],
      ],
    ]);
    const plan = planUpgrade({
      installed: [installed(m)],
      targetEngineVersion: '3.0.0',
      catalogue,
    });
    expect(plan.rows[0]?.status).toBe('blocked');
  });

  it('preserves installed-list order in the rows output', () => {
    const a = manifest({ id: 'a', platformCompatibility: '^2.0.0' });
    const b = manifest({ id: 'b', platformCompatibility: '^2.0.0' });
    const c = manifest({ id: 'c', platformCompatibility: '^2.0.0' });
    const plan = planUpgrade({
      installed: [installed(b), installed(a), installed(c)],
      targetEngineVersion: '2.5.0',
    });
    expect(plan.rows.map((r) => r.packId)).toEqual(['b', 'a', 'c']);
  });

  it('exposes the target engine version on the plan', () => {
    const plan = planUpgrade({ installed: [], targetEngineVersion: '4.2.0' });
    expect(plan.targetEngineVersion).toBe('4.2.0');
  });

  it('summary counts match row statuses', () => {
    const a = manifest({ id: 'a', platformCompatibility: '^2.0.0' });
    const b = manifest({ id: 'b', platformCompatibility: '^2.0.0' });
    const plan = planUpgrade({
      installed: [installed(a), installed(b)],
      targetEngineVersion: '2.5.0',
    });
    const counted = {
      compatible: plan.rows.filter((r) => r.status === 'compatible').length,
      needsUpgrade: plan.rows.filter((r) => r.status === 'needs-upgrade').length,
      blocked: plan.rows.filter((r) => r.status === 'blocked').length,
      manifestVersionIncompatible: plan.rows.filter(
        (r) => r.status === 'manifest-version-incompatible',
      ).length,
    };
    expect(counted).toEqual(plan.summary);
  });

  it('carries currentVersion + currentPlatformCompatibility verbatim into the row', () => {
    const m = manifest({ version: '7.8.9', platformCompatibility: '~3.4.0' });
    const plan = planUpgrade({ installed: [installed(m)], targetEngineVersion: '3.4.5' });
    expect(plan.rows[0]?.currentVersion).toBe('7.8.9');
    expect(plan.rows[0]?.currentPlatformCompatibility).toBe('~3.4.0');
  });
});

describe('catalogueKey', () => {
  it('joins publisher + pack id with a slash', () => {
    expect(catalogueKey('pub-1', 'pack-a')).toBe('pub-1/pack-a');
  });
});
