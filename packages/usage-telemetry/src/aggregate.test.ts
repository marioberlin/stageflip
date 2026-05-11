// packages/usage-telemetry/src/aggregate.test.ts
// Contract tests for `aggregateUsage`.

import { describe, expect, it } from 'vitest';
import { UsageAggregationError, aggregateUsage } from './aggregate.js';
import type { AdapterUsageEvent } from './types.js';

const makeEvent = (over: Partial<AdapterUsageEvent> = {}): AdapterUsageEvent => ({
  tenantId: 'tenant-a',
  adapterId: 'kokoro-tts',
  modality: 'tts',
  selectedReason: 'capability-router',
  latencyMs: 100,
  costAmount: 0,
  costCurrency: 'USD',
  outcome: 'success',
  timestamp: '2026-05-11T12:00:00.000Z',
  ...over,
});

describe('aggregateUsage', () => {
  it('returns empty on empty input', () => {
    expect(aggregateUsage([], { tenantId: 't' })).toEqual([]);
  });

  it('returns empty when tenant has no events', () => {
    const events = [makeEvent({ tenantId: 't1' }), makeEvent({ tenantId: 't2' })];
    expect(aggregateUsage(events, { tenantId: 't3' })).toEqual([]);
  });

  it('rolls up a single event into a single bucket', () => {
    const rollups = aggregateUsage([makeEvent()], { tenantId: 'tenant-a' });
    expect(rollups).toEqual([
      {
        tenantId: 'tenant-a',
        adapterId: 'kokoro-tts',
        modality: 'tts',
        count: 1,
        successCount: 1,
        failedCount: 0,
        killedCount: 0,
        p50LatencyMs: 100,
        p95LatencyMs: 100,
        totalCostAmount: 0,
        costCurrency: 'USD',
      },
    ]);
  });

  it('buckets by (adapterId, modality)', () => {
    const events = [
      makeEvent({ adapterId: 'kokoro-tts', modality: 'tts' }),
      makeEvent({ adapterId: 'fish-speech', modality: 'tts' }),
      makeEvent({ adapterId: 'kokoro-tts', modality: 'tts' }),
    ];
    const rollups = aggregateUsage(events, { tenantId: 'tenant-a' });
    expect(rollups.length).toBe(2);
    const byId = new Map(rollups.map((r) => [r.adapterId, r]));
    expect(byId.get('kokoro-tts')?.count).toBe(2);
    expect(byId.get('fish-speech')?.count).toBe(1);
  });

  it('filters by adapterId', () => {
    const events = [
      makeEvent({ adapterId: 'kokoro-tts' }),
      makeEvent({ adapterId: 'fish-speech' }),
    ];
    const rollups = aggregateUsage(events, { tenantId: 'tenant-a', adapterId: 'kokoro-tts' });
    expect(rollups.length).toBe(1);
    expect(rollups[0]?.adapterId).toBe('kokoro-tts');
  });

  it('filters by time window — inclusive start, exclusive end', () => {
    const events = [
      makeEvent({ timestamp: '2026-05-10T00:00:00.000Z' }), // before window
      makeEvent({ timestamp: '2026-05-11T00:00:00.000Z' }), // at start
      makeEvent({ timestamp: '2026-05-11T12:00:00.000Z' }), // inside
      makeEvent({ timestamp: '2026-05-12T00:00:00.000Z' }), // at end (excluded)
      makeEvent({ timestamp: '2026-05-13T00:00:00.000Z' }), // after
    ];
    const rollups = aggregateUsage(events, {
      tenantId: 'tenant-a',
      sinceTimestamp: '2026-05-11T00:00:00.000Z',
      untilTimestamp: '2026-05-12T00:00:00.000Z',
    });
    expect(rollups[0]?.count).toBe(2);
  });

  it('counts each outcome separately', () => {
    const events = [
      makeEvent({ outcome: 'success' }),
      makeEvent({ outcome: 'success' }),
      makeEvent({ outcome: 'failed' }),
      makeEvent({ outcome: 'killed' }),
    ];
    const r = aggregateUsage(events, { tenantId: 'tenant-a' })[0];
    expect(r?.successCount).toBe(2);
    expect(r?.failedCount).toBe(1);
    expect(r?.killedCount).toBe(1);
    expect(r?.count).toBe(4);
  });

  it('sums totalCostAmount', () => {
    const events = [
      makeEvent({ costAmount: 0.01 }),
      makeEvent({ costAmount: 0.02 }),
      makeEvent({ costAmount: 0.04 }),
    ];
    const r = aggregateUsage(events, { tenantId: 'tenant-a' })[0];
    expect(r?.totalCostAmount).toBeCloseTo(0.07, 10);
  });

  it('computes nearest-rank p50 and p95 on sorted latencies', () => {
    // latencies 100..1000 step 100; p50 → idx ceil(0.5*10)-1 = 4 → 500; p95 → idx 9 → 1000
    const events = Array.from({ length: 10 }, (_, i) => makeEvent({ latencyMs: (i + 1) * 100 }));
    const r = aggregateUsage(events, { tenantId: 'tenant-a' })[0];
    expect(r?.p50LatencyMs).toBe(500);
    expect(r?.p95LatencyMs).toBe(1000);
  });

  it('p95 with a single event equals the latency', () => {
    const r = aggregateUsage([makeEvent({ latencyMs: 250 })], { tenantId: 'tenant-a' })[0];
    expect(r?.p50LatencyMs).toBe(250);
    expect(r?.p95LatencyMs).toBe(250);
  });

  it('rejects mixed currencies in a single bucket', () => {
    const events = [
      makeEvent({ costAmount: 1, costCurrency: 'USD' }),
      makeEvent({ costAmount: 1, costCurrency: 'EUR' }),
    ];
    expect(() => aggregateUsage(events, { tenantId: 'tenant-a' })).toThrow(UsageAggregationError);
  });

  it('does not cross-bucket across tenants — multi-tenant isolation', () => {
    const events = [
      makeEvent({ tenantId: 't1', costAmount: 0.01 }),
      makeEvent({ tenantId: 't2', costAmount: 99 }),
    ];
    const r = aggregateUsage(events, { tenantId: 't1' });
    expect(r.length).toBe(1);
    expect(r[0]?.totalCostAmount).toBe(0.01);
  });
});
