// packages/marketplace-telemetry-dashboard/src/storage/in-memory.test.ts
// T-541 — Coverage for `InMemoryTimeSeriesStore`: write+query roundtrip,
// time-range filtering, kind filtering, packIdHash filtering, empty
// query.

import { describe, expect, it } from 'vitest';

import { InMemoryTimeSeriesStore } from './in-memory.js';
import type { TimeSeriesEvent } from './timeseries.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const ev = (overrides: Partial<TimeSeriesEvent> = {}): TimeSeriesEvent => ({
  kind: 'install',
  packIdHash: HASH_A,
  packVersion: '1.0.0',
  at: '2026-05-13T00:00:00Z',
  payload: {},
  ...overrides,
});

describe('InMemoryTimeSeriesStore', () => {
  it('round-trips a written batch via query', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([ev({ at: '2026-05-13T00:00:00Z' })]);
    const got = await store.query({
      fromIso: '2026-05-12T00:00:00Z',
      toIso: '2026-05-14T00:00:00Z',
    });
    expect(got.length).toBe(1);
    expect(got[0]?.packIdHash).toBe(HASH_A);
  });

  it('filters by half-open time range', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([
      ev({ at: '2026-05-12T00:00:00Z' }),
      ev({ at: '2026-05-13T00:00:00Z' }),
      ev({ at: '2026-05-14T00:00:00Z' }),
    ]);
    const got = await store.query({
      fromIso: '2026-05-13T00:00:00Z',
      toIso: '2026-05-14T00:00:00Z',
    });
    expect(got.length).toBe(1);
    expect(got[0]?.at).toBe('2026-05-13T00:00:00Z');
  });

  it('filters by kind', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([ev({ kind: 'install' }), ev({ kind: 'activation' }), ev({ kind: 'usage' })]);
    const got = await store.query({
      kind: 'activation',
      fromIso: '2000-01-01T00:00:00Z',
      toIso: '2100-01-01T00:00:00Z',
    });
    expect(got.length).toBe(1);
    expect(got[0]?.kind).toBe('activation');
  });

  it('filters by packIdHash', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([ev({ packIdHash: HASH_A }), ev({ packIdHash: HASH_B })]);
    const got = await store.query({
      packIdHash: HASH_B,
      fromIso: '2000-01-01T00:00:00Z',
      toIso: '2100-01-01T00:00:00Z',
    });
    expect(got.length).toBe(1);
    expect(got[0]?.packIdHash).toBe(HASH_B);
  });

  it('returns empty array when no events match', async () => {
    const store = new InMemoryTimeSeriesStore();
    await store.write([ev({ at: '2026-05-13T00:00:00Z' })]);
    const got = await store.query({
      fromIso: '2030-01-01T00:00:00Z',
      toIso: '2031-01-01T00:00:00Z',
    });
    expect(got).toEqual([]);
  });

  it('defensive-copies the payload on write', async () => {
    const store = new InMemoryTimeSeriesStore();
    const payload: Record<string, unknown> = { mountedAnyClip: true };
    await store.write([ev({ kind: 'activation', payload })]);
    payload.mountedAnyClip = false;
    const got = await store.query({
      fromIso: '2000-01-01T00:00:00Z',
      toIso: '2100-01-01T00:00:00Z',
    });
    expect(got[0]?.payload.mountedAnyClip).toBe(true);
  });
});
