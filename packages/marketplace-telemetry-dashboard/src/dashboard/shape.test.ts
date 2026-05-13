// packages/marketplace-telemetry-dashboard/src/dashboard/shape.test.ts
// T-541 — Coverage: empty store, populated store, window filtering,
// packIdHash filtering.

import { hashPackId } from '@stageflip/pack-telemetry';
import { describe, expect, it } from 'vitest';

import { InMemoryTimeSeriesStore } from '../storage/in-memory.js';
import type { TimeSeriesEvent } from '../storage/timeseries.js';
import { buildDashboardData } from './shape.js';

const NEWS_PRO_HASH = hashPackId('stageflip', 'news-pro');
const FINANCE_HASH = hashPackId('stageflip', 'finance');

const installRow = (hash: string, at: string): TimeSeriesEvent => ({
  kind: 'install',
  packIdHash: hash,
  packVersion: '1.0.0',
  at,
  payload: { licenseKind: 'paid-per-tenant', engineVersion: '1.0.0', platform: 'darwin' },
});

const activationRow = (hash: string, at: string): TimeSeriesEvent => ({
  kind: 'activation',
  packIdHash: hash,
  packVersion: '1.0.0',
  at,
  payload: { mountedAnyClip: true },
});

const usageRow = (hash: string, at: string, n: number): TimeSeriesEvent => ({
  kind: 'usage',
  packIdHash: hash,
  packVersion: '1.0.0',
  at,
  payload: { clipMountCount: n, windowSeconds: 3600 },
});

describe('buildDashboardData', () => {
  it('returns a zeroed dashboard for an empty store', async () => {
    const store = new InMemoryTimeSeriesStore();
    const out = await buildDashboardData(NEWS_PRO_HASH, store, {
      fromIso: '2026-05-01T00:00:00Z',
      toIso: '2026-06-01T00:00:00Z',
    });
    expect(out.packIdHash).toBe(NEWS_PRO_HASH);
    expect(out.installCountByDay).toEqual([]);
    expect(out.installCountByWeek).toEqual([]);
    expect(out.activationRate).toEqual({ installs: 0, activations: 0, rate: 0 });
    expect(out.averageClipMountCount).toBe(0);
    expect(out.retentionCurve).toEqual([]);
  });

  it('produces a shaped output for a populated store', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([
      installRow(NEWS_PRO_HASH, '2026-05-13T01:00:00Z'),
      installRow(NEWS_PRO_HASH, '2026-05-13T02:00:00Z'),
      activationRow(NEWS_PRO_HASH, '2026-05-13T05:00:00Z'),
      usageRow(NEWS_PRO_HASH, '2026-05-13T06:00:00Z', 7),
    ]);
    const out = await buildDashboardData(NEWS_PRO_HASH, store, {
      fromIso: '2026-05-01T00:00:00Z',
      toIso: '2026-06-01T00:00:00Z',
    });
    expect(out.installCountByDay).toEqual([{ dayIso: '2026-05-13', count: 2 }]);
    // activationRate dedupes by (packIdHash, packVersion); two install events
    // for the same pack+version → 1 unique install for rate-computation.
    expect(out.activationRate.installs).toBe(1);
    expect(out.averageClipMountCount).toBe(7);
    expect(out.retentionCurve[0]?.daysSinceInstall).toBe(0);
  });

  it('filters events outside the window', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([
      installRow(NEWS_PRO_HASH, '2025-01-01T00:00:00Z'),
      installRow(NEWS_PRO_HASH, '2026-05-13T00:00:00Z'),
    ]);
    const out = await buildDashboardData(NEWS_PRO_HASH, store, {
      fromIso: '2026-05-01T00:00:00Z',
      toIso: '2026-06-01T00:00:00Z',
    });
    expect(out.installCountByDay).toEqual([{ dayIso: '2026-05-13', count: 1 }]);
  });

  it('filters by packIdHash', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([
      installRow(NEWS_PRO_HASH, '2026-05-13T00:00:00Z'),
      installRow(FINANCE_HASH, '2026-05-13T00:00:00Z'),
    ]);
    const out = await buildDashboardData(NEWS_PRO_HASH, store, {
      fromIso: '2026-05-01T00:00:00Z',
      toIso: '2026-06-01T00:00:00Z',
    });
    expect(out.installCountByDay).toEqual([{ dayIso: '2026-05-13', count: 1 }]);
  });
});
