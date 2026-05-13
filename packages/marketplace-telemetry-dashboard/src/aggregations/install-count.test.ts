// packages/marketplace-telemetry-dashboard/src/aggregations/install-count.test.ts
// T-541 — Coverage: empty input, single install, multi-day, kind filter,
// week bucketing.

import { describe, expect, it } from 'vitest';

import type { TimeSeriesEvent } from '../storage/timeseries.js';
import { installCountByDay, installCountByWeek } from './install-count.js';

const HASH = 'a'.repeat(64);

const ev = (kind: TimeSeriesEvent['kind'], at: string): TimeSeriesEvent => ({
  kind,
  packIdHash: HASH,
  packVersion: '1.0.0',
  at,
  payload: {},
});

describe('installCountByDay', () => {
  it('returns [] for an empty input', () => {
    expect(installCountByDay([])).toEqual([]);
  });

  it('returns one bucket of count=1 for a single install', () => {
    const out = installCountByDay([ev('install', '2026-05-13T10:30:00Z')]);
    expect(out).toEqual([{ dayIso: '2026-05-13', count: 1 }]);
  });

  it('groups multiple installs across days, sorted ascending', () => {
    const out = installCountByDay([
      ev('install', '2026-05-14T09:00:00Z'),
      ev('install', '2026-05-13T01:00:00Z'),
      ev('install', '2026-05-13T23:59:59Z'),
    ]);
    expect(out).toEqual([
      { dayIso: '2026-05-13', count: 2 },
      { dayIso: '2026-05-14', count: 1 },
    ]);
  });

  it('ignores activation + usage events', () => {
    const out = installCountByDay([
      ev('install', '2026-05-13T00:00:00Z'),
      ev('activation', '2026-05-13T00:00:00Z'),
      ev('usage', '2026-05-13T00:00:00Z'),
    ]);
    expect(out).toEqual([{ dayIso: '2026-05-13', count: 1 }]);
  });
});

describe('installCountByWeek', () => {
  it('buckets by Monday-anchored ISO week', () => {
    // 2026-05-13 (Wed) and 2026-05-15 (Fri) both belong to week starting 2026-05-11 (Mon).
    // 2026-05-18 (Mon) starts the next week.
    const out = installCountByWeek([
      ev('install', '2026-05-13T00:00:00Z'),
      ev('install', '2026-05-15T00:00:00Z'),
      ev('install', '2026-05-18T00:00:00Z'),
    ]);
    expect(out).toEqual([
      { weekStartIso: '2026-05-11', count: 2 },
      { weekStartIso: '2026-05-18', count: 1 },
    ]);
  });
});
