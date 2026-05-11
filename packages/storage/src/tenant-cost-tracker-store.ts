// packages/storage/src/tenant-cost-tracker-store.ts
// TenantCostTrackerStore — contract interface + in-memory implementation per
// T-443. A separate facet from `StorageAdapter` (doc-scoped) and
// `TenantSettingsStore` (single-row-per-tenant) — the cost-tracker is a
// per-tenant ACCUMULATOR of cost records. The v1 in-memory implementation
// is a stub; production wire-up (Postgres / Firebase) lands downstream.
//
// `getPeriodTotal(tenantId, periodStart, periodEnd)` sums records whose
// `recordedAt ∈ [periodStart, periodEnd)` — half-open interval (inclusive
// start, exclusive end). This matches how the `aiBudget.periodEnd` is
// interpreted in `query_cost_budget`: a record AT periodEnd is the FIRST
// record of the NEXT period.

/**
 * A single cost record — produced by `generate_asset` on adapter success
 * (T-443; the asset-gen handler records the chosen adapter's
 * `costPerCall.usd`). Currency is ISO-4217 alpha-3; the store does NOT
 * cross-convert.
 */
export interface CostRecord {
  readonly tenantId: string;
  readonly adapterId: string;
  readonly amount: number;
  readonly currency: string;
  readonly recordedAt: string;
}

/**
 * Storage facet for per-tenant AI-cost tracking. Concrete adapters
 * (in-memory, Postgres, Firebase) all implement this contract; consumers
 * pick the adapter at boot — mirrors the T-411a `TenantSettingsStore`
 * pattern.
 */
export interface TenantCostTrackerStore {
  /**
   * Append a cost record to the tenant's accumulator. Implementations
   * MUST persist the record verbatim (no normalization of amounts /
   * currencies); the in-memory implementation appends to an array.
   */
  recordCost(record: CostRecord): Promise<void>;

  /**
   * Sum the tenant's recorded costs whose `recordedAt` lies in
   * `[periodStart, periodEnd)` — inclusive start, exclusive end.
   * Returns `0` when no records match (including unknown tenant).
   *
   * Single-currency assumption: callers ensure all records for a
   * tenant share one currency (enforced upstream by
   * `aiBudgetSchema.currency`). The store does NOT cross-convert.
   */
  getPeriodTotal(tenantId: string, periodStart: string, periodEnd: string): Promise<number>;

  /**
   * All recorded costs for a tenant, in insertion order. Exposed for
   * audit-trail / debugging surfaces; not a hot path.
   */
  listCosts(tenantId: string): Promise<readonly CostRecord[]>;
}

/**
 * In-memory TenantCostTrackerStore. Single-process, not thread-safe in
 * the worker-thread sense; fine for tests and dev. Records live in a
 * Map keyed on `tenantId` with each value being an append-only array.
 * `reset()` clears all rows.
 */
export class InMemoryTenantCostTrackerStore implements TenantCostTrackerStore {
  private rows = new Map<string, CostRecord[]>();

  async recordCost(record: CostRecord): Promise<void> {
    const existing = this.rows.get(record.tenantId);
    if (existing === undefined) {
      this.rows.set(record.tenantId, [record]);
      return;
    }
    existing.push(record);
  }

  async getPeriodTotal(tenantId: string, periodStart: string, periodEnd: string): Promise<number> {
    const records = this.rows.get(tenantId);
    if (records === undefined) return 0;
    let total = 0;
    for (const r of records) {
      // Lexicographic comparison on ISO-8601 datetime strings is
      // equivalent to chronological comparison (the format is
      // designed for it). Half-open interval: inclusive start,
      // exclusive end.
      if (r.recordedAt >= periodStart && r.recordedAt < periodEnd) {
        total += r.amount;
      }
    }
    return total;
  }

  async listCosts(tenantId: string): Promise<readonly CostRecord[]> {
    const records = this.rows.get(tenantId);
    return records === undefined ? [] : [...records];
  }

  /** Test-only hook to clear all state. */
  reset(): void {
    this.rows.clear();
  }

  /** Number of tenants with at least one recorded cost. Exposed for tests. */
  size(): number {
    return this.rows.size;
  }
}
