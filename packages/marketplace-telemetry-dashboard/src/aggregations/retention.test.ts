// packages/marketplace-telemetry-dashboard/src/aggregations/retention.test.ts
// T-541 — Coverage: empty, single install no activation, install +
// day-0 activation, multi-pack averaging.

import { describe, expect, it } from 'vitest';

import type { TimeSeriesEvent } from '../storage/timeseries.js';
import { retentionCurve } from './retention.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const install = (hash: string, dayIso: string): TimeSeriesEvent => ({
  kind: 'install',
  packIdHash: hash,
  packVersion: '1.0.0',
  at: `${dayIso}T00:00:00Z`,
  payload: {},
});

const activate = (hash: string, dayIso: string, mountedAnyClip = true): TimeSeriesEvent => ({
  kind: 'activation',
  packIdHash: hash,
  packVersion: '1.0.0',
  at: `${dayIso}T01:00:00Z`,
  payload: { mountedAnyClip },
});

describe('retentionCurve', () => {
  it('returns [] for empty input', () => {
    expect(retentionCurve([])).toEqual([]);
  });

  it('returns a single zero-fraction point when no activations exist', () => {
    const out = retentionCurve([install(HASH_A, '2026-05-13')]);
    expect(out).toEqual([{ daysSinceInstall: 0, activeFraction: 0 }]);
  });

  it('produces a curve with day 0 = 1.0 for a single install + same-day activation', () => {
    const out = retentionCurve([install(HASH_A, '2026-05-13'), activate(HASH_A, '2026-05-13')]);
    expect(out).toEqual([{ daysSinceInstall: 0, activeFraction: 1 }]);
  });

  it('averages activation across two packs at days 0 and 2', () => {
    // HASH_A: install day 0, activate day 0 + day 2
    // HASH_B: install day 0, activate day 0 only
    const out = retentionCurve([
      install(HASH_A, '2026-05-13'),
      install(HASH_B, '2026-05-13'),
      activate(HASH_A, '2026-05-13'),
      activate(HASH_A, '2026-05-15'),
      activate(HASH_B, '2026-05-13'),
    ]);
    expect(out).toEqual([
      { daysSinceInstall: 0, activeFraction: 1 },
      { daysSinceInstall: 1, activeFraction: 0 },
      { daysSinceInstall: 2, activeFraction: 0.5 },
    ]);
  });

  it('ignores activations with mountedAnyClip=false', () => {
    const out = retentionCurve([
      install(HASH_A, '2026-05-13'),
      activate(HASH_A, '2026-05-13', false),
    ]);
    expect(out).toEqual([{ daysSinceInstall: 0, activeFraction: 0 }]);
  });
});
