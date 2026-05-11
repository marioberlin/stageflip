// packages/storage/src/tenant-cost-tracker-store.test.ts
// Contract tests for InMemoryTenantCostTrackerStore (T-443 AC #2). The same
// surface is mirrored by future Postgres + Firebase adapter test files so
// 3-adapter parity is provable by name alignment (mirrors TenantSettingsStore
// from T-411a).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CostRecord, InMemoryTenantCostTrackerStore } from './tenant-cost-tracker-store.js';

const baseRecord = (over: Partial<CostRecord> = {}): CostRecord => ({
  tenantId: 'tenant-1',
  adapterId: 'tts-fake',
  amount: 0.05,
  currency: 'USD',
  recordedAt: '2026-05-11T00:00:00.000Z',
  ...over,
});

describe('InMemoryTenantCostTrackerStore', () => {
  let store: InMemoryTenantCostTrackerStore;

  beforeEach(() => {
    store = new InMemoryTenantCostTrackerStore();
  });

  afterEach(() => {
    store.reset();
  });

  describe('recordCost + listCosts', () => {
    it('returns an empty list for an unknown tenant', async () => {
      expect(await store.listCosts('missing')).toEqual([]);
    });

    it('round-trips a single recorded cost', async () => {
      const r = baseRecord();
      await store.recordCost(r);
      expect(await store.listCosts('tenant-1')).toEqual([r]);
    });

    it('accumulates multiple recorded costs in insertion order', async () => {
      await store.recordCost(baseRecord({ adapterId: 'a', amount: 0.1 }));
      await store.recordCost(baseRecord({ adapterId: 'b', amount: 0.2 }));
      await store.recordCost(baseRecord({ adapterId: 'c', amount: 0.3 }));
      const out = await store.listCosts('tenant-1');
      expect(out.map((r) => r.adapterId)).toEqual(['a', 'b', 'c']);
    });

    it('isolates per-tenant accumulators', async () => {
      await store.recordCost(baseRecord({ tenantId: 'tenant-1', amount: 0.1 }));
      await store.recordCost(baseRecord({ tenantId: 'tenant-2', amount: 0.5 }));
      expect((await store.listCosts('tenant-1')).length).toBe(1);
      expect((await store.listCosts('tenant-2')).length).toBe(1);
      expect((await store.listCosts('tenant-1'))[0]?.amount).toBe(0.1);
      expect((await store.listCosts('tenant-2'))[0]?.amount).toBe(0.5);
    });
  });

  describe('getPeriodTotal', () => {
    it('returns 0 for an unknown tenant', async () => {
      expect(
        await store.getPeriodTotal(
          'missing',
          '2026-05-01T00:00:00.000Z',
          '2026-06-01T00:00:00.000Z',
        ),
      ).toBe(0);
    });

    it('sums all costs in the period for a single tenant', async () => {
      await store.recordCost(baseRecord({ amount: 0.1, recordedAt: '2026-05-05T00:00:00.000Z' }));
      await store.recordCost(baseRecord({ amount: 0.2, recordedAt: '2026-05-15T00:00:00.000Z' }));
      await store.recordCost(baseRecord({ amount: 0.3, recordedAt: '2026-05-25T00:00:00.000Z' }));
      const total = await store.getPeriodTotal(
        'tenant-1',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      expect(total).toBeCloseTo(0.6, 10);
    });

    it('excludes records OUTSIDE the period bounds', async () => {
      // 2 inside, 1 before, 1 after.
      await store.recordCost(baseRecord({ amount: 999, recordedAt: '2026-04-15T00:00:00.000Z' }));
      await store.recordCost(baseRecord({ amount: 0.1, recordedAt: '2026-05-05T00:00:00.000Z' }));
      await store.recordCost(baseRecord({ amount: 0.2, recordedAt: '2026-05-25T00:00:00.000Z' }));
      await store.recordCost(baseRecord({ amount: 999, recordedAt: '2026-06-15T00:00:00.000Z' }));
      const total = await store.getPeriodTotal(
        'tenant-1',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      expect(total).toBeCloseTo(0.3, 10);
    });

    it('uses half-open interval [start, end) — records AT periodEnd excluded', async () => {
      // periodEnd boundary record should NOT be counted.
      await store.recordCost(baseRecord({ amount: 1, recordedAt: '2026-06-01T00:00:00.000Z' }));
      const total = await store.getPeriodTotal(
        'tenant-1',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      expect(total).toBe(0);
    });

    it('uses inclusive periodStart — records AT periodStart are counted', async () => {
      await store.recordCost(baseRecord({ amount: 1, recordedAt: '2026-05-01T00:00:00.000Z' }));
      const total = await store.getPeriodTotal(
        'tenant-1',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      expect(total).toBe(1);
    });

    it('isolates per-tenant totals', async () => {
      await store.recordCost(baseRecord({ tenantId: 'tenant-1', amount: 0.1 }));
      await store.recordCost(baseRecord({ tenantId: 'tenant-2', amount: 0.5 }));
      const t1 = await store.getPeriodTotal(
        'tenant-1',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      const t2 = await store.getPeriodTotal(
        'tenant-2',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );
      expect(t1).toBeCloseTo(0.1, 10);
      expect(t2).toBeCloseTo(0.5, 10);
    });
  });

  describe('reset', () => {
    it('clears all recorded costs across all tenants', async () => {
      await store.recordCost(baseRecord({ tenantId: 'tenant-1' }));
      await store.recordCost(baseRecord({ tenantId: 'tenant-2' }));
      store.reset();
      expect(await store.listCosts('tenant-1')).toEqual([]);
      expect(await store.listCosts('tenant-2')).toEqual([]);
    });
  });
});
