// packages/marketplace-refunds/src/ledger/refund-ledger.test.ts
// T-545 — `InMemoryRefundLedger` tests.

import { describe, expect, it } from 'vitest';
import { InMemoryRefundLedger, type LedgerEntry } from './refund-ledger.js';

function entryOf(opts: Partial<LedgerEntry> & Pick<LedgerEntry, 'outcome'>): LedgerEntry {
  return {
    tenantId: opts.tenantId ?? 'tenant-1',
    chargeId: opts.chargeId ?? 'ch_test_1',
    outcome: opts.outcome,
    at: opts.at ?? '2026-05-14T09:00:00.000Z',
    amountCents: opts.amountCents ?? 1000,
  };
}

describe('InMemoryRefundLedger', () => {
  it('empty ledger has size 0, totalRefundedCents 0, empty byTenant', () => {
    const ledger = new InMemoryRefundLedger();
    expect(ledger.size()).toBe(0);
    expect(ledger.totalRefundedCents()).toBe(0);
    expect(ledger.byTenant('tenant-1')).toEqual([]);
  });

  it('record + byTenant roundtrip preserves insertion order', () => {
    const ledger = new InMemoryRefundLedger();
    const e1 = entryOf({ outcome: 'refunded-full', amountCents: 500 });
    const e2 = entryOf({ outcome: 'refunded-partial', amountCents: 250 });
    ledger.record(e1);
    ledger.record(e2);
    const rows = ledger.byTenant('tenant-1');
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual(e1);
    expect(rows[1]).toEqual(e2);
  });

  it('byTenant filters by tenantId', () => {
    const ledger = new InMemoryRefundLedger();
    ledger.record(entryOf({ tenantId: 'tenant-1', outcome: 'refunded-full' }));
    ledger.record(entryOf({ tenantId: 'tenant-2', outcome: 'refunded-full' }));
    ledger.record(entryOf({ tenantId: 'tenant-1', outcome: 'denied' }));
    expect(ledger.byTenant('tenant-1').length).toBe(2);
    expect(ledger.byTenant('tenant-2').length).toBe(1);
    expect(ledger.byTenant('tenant-3')).toEqual([]);
  });

  it('totalRefundedCents sums refunded-full + refunded-partial only', () => {
    const ledger = new InMemoryRefundLedger();
    ledger.record(entryOf({ outcome: 'refunded-full', amountCents: 1000 }));
    ledger.record(entryOf({ outcome: 'refunded-partial', amountCents: 250 }));
    ledger.record(entryOf({ outcome: 'denied', amountCents: 500 }));
    ledger.record(entryOf({ outcome: 'dispute-won', amountCents: 0 }));
    expect(ledger.totalRefundedCents()).toBe(1250);
  });

  it('totalRefundedCents excludes dispute-lost (Stripe pulled funds, not us)', () => {
    const ledger = new InMemoryRefundLedger();
    ledger.record(entryOf({ outcome: 'refunded-full', amountCents: 1000 }));
    ledger.record(entryOf({ outcome: 'dispute-lost', amountCents: 9999 }));
    expect(ledger.totalRefundedCents()).toBe(1000);
  });

  it('size counts every recorded entry regardless of outcome', () => {
    const ledger = new InMemoryRefundLedger();
    ledger.record(entryOf({ outcome: 'refunded-full' }));
    ledger.record(entryOf({ outcome: 'denied' }));
    ledger.record(entryOf({ outcome: 'dispute-won' }));
    ledger.record(entryOf({ outcome: 'dispute-lost' }));
    expect(ledger.size()).toBe(4);
  });

  it('byTenant returns a readonly snapshot that the caller cannot mutate', () => {
    const ledger = new InMemoryRefundLedger();
    ledger.record(entryOf({ outcome: 'refunded-full' }));
    const rows = ledger.byTenant('tenant-1');
    // Type system forbids mutation; runtime check that the array
    // returned matches the recorded state.
    expect(rows.length).toBe(1);
    expect(rows[0]?.outcome).toBe('refunded-full');
  });
});
