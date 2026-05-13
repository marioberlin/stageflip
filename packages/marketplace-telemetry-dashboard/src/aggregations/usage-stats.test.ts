// packages/marketplace-telemetry-dashboard/src/aggregations/usage-stats.test.ts
// T-541 — Coverage: empty, single event, multi-event average, malformed
// payload, kind filter.

import { describe, expect, it } from 'vitest';

import type { TimeSeriesEvent } from '../storage/timeseries.js';
import { averageClipMountCount } from './usage-stats.js';

const HASH = 'a'.repeat(64);

const usage = (clipMountCount: unknown): TimeSeriesEvent => ({
  kind: 'usage',
  packIdHash: HASH,
  packVersion: '1.0.0',
  at: '2026-05-13T00:00:00Z',
  payload: { clipMountCount, windowSeconds: 3600 },
});

describe('averageClipMountCount', () => {
  it('returns 0 for empty input', () => {
    expect(averageClipMountCount([])).toBe(0);
  });

  it('returns N for a single usage event with N mounts', () => {
    expect(averageClipMountCount([usage(7)])).toBe(7);
  });

  it('averages across multiple usage events', () => {
    expect(averageClipMountCount([usage(2), usage(4), usage(6)])).toBe(4);
  });

  it('treats malformed clipMountCount payloads as 0', () => {
    expect(averageClipMountCount([usage('nope'), usage(10)])).toBe(5);
  });

  it('ignores non-usage events', () => {
    const installEv: TimeSeriesEvent = {
      kind: 'install',
      packIdHash: HASH,
      packVersion: '1.0.0',
      at: '2026-05-13T00:00:00Z',
      payload: {},
    };
    expect(averageClipMountCount([installEv, usage(5)])).toBe(5);
  });
});
