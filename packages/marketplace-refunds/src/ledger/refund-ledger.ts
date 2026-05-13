// packages/marketplace-refunds/src/ledger/refund-ledger.ts
// T-545 — `InMemoryRefundLedger` is the audit-trail aggregator the
// deployment layer feeds after every refund / dispute decision is
// applied. The ledger is pure + in-memory; production deployments
// snapshot the ledger on a cadence and ship it to the durable
// refund-history store (the dashboard / finance reconciliation
// pipeline owns retention).
//
// The class is intentionally minimal: append-only `record`,
// per-tenant projection, and a refunds-only sum. Disputes-lost
// entries land in the ledger for audit but are NOT counted toward
// `totalRefundedCents` (a lost dispute means Stripe pulled funds —
// it's not a refund we issued).
//
// Determinism perimeter: outside (server-side).

/**
 * Terminal outcome a deployment can record. Maps loosely onto the
 * refund + dispute decision unions:
 *
 * - `'refunded-full'`: a `processRefund` `'approved-full'` was
 *   executed against Stripe.
 * - `'refunded-partial'`: a `processRefund` `'approved-partial'` was
 *   executed.
 * - `'denied'`: a refund request was denied. Booked for audit; the
 *   `amountCents` field carries the requested (not refunded) amount.
 * - `'dispute-won'`: Stripe ruled in our favour on a chargeback.
 *   Booked for audit; amount=0 by convention.
 * - `'dispute-lost'`: Stripe ruled against us; funds pulled. The
 *   `amountCents` field carries the lost amount but does NOT count
 *   toward `totalRefundedCents`.
 */
export type LedgerOutcome =
  | 'refunded-full'
  | 'refunded-partial'
  | 'denied'
  | 'dispute-won'
  | 'dispute-lost';

/** A single audit-trail row. */
export interface LedgerEntry {
  readonly tenantId: string;
  readonly chargeId: string;
  readonly outcome: LedgerOutcome;
  readonly at: string;
  readonly amountCents: number;
}

/**
 * In-memory ledger. The deployment layer instantiates one ledger
 * per service process and calls `record` at every decision point.
 * Snapshot via `byTenant` / `totalRefundedCents`; durability is the
 * caller's responsibility.
 */
export class InMemoryRefundLedger {
  #entries: LedgerEntry[] = [];

  /** Append a single entry. Insertion order is preserved. */
  record(entry: LedgerEntry): void {
    this.#entries.push(entry);
  }

  /** Snapshot of entries for one tenant, in insertion order. */
  byTenant(tenantId: string): readonly LedgerEntry[] {
    return this.#entries.filter((e) => e.tenantId === tenantId);
  }

  /**
   * Total refunded amount (cents) across all entries. Only
   * `refunded-full` + `refunded-partial` count; denials and
   * disputes are excluded.
   */
  totalRefundedCents(): number {
    let total = 0;
    for (const e of this.#entries) {
      if (e.outcome === 'refunded-full' || e.outcome === 'refunded-partial') {
        total += e.amountCents;
      }
    }
    return total;
  }

  /** Total entry count across all tenants + outcomes. */
  size(): number {
    return this.#entries.length;
  }
}
