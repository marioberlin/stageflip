// packages/usage-telemetry/src/aggregate.ts
// `aggregateUsage` — pure rollup helper. Buckets a flat array of
// `AdapterUsageEvent`s by `(tenantId, adapterId, modality)` and reports
// count / outcome counts / p50+p95 latency / total cost per bucket.
//
// Determinism posture: pure. No clock, no RNG, no I/O. ISO-8601
// lexicographic timestamp comparison (the format is designed for it).

import type { AdapterUsageEvent } from './types.js';

/**
 * One bucket of usage rollup output. Currency is single-valued — the
 * aggregator throws `UsageAggregationError` if a bucket would mix
 * currencies (which never happens in v1; tenants are single-currency
 * per T-443's `aiBudget.currency`).
 */
export interface UsageRollup {
  readonly tenantId: string;
  readonly adapterId: string;
  readonly modality: string;
  readonly count: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly killedCount: number;
  /** Nearest-rank p50 latency in milliseconds. */
  readonly p50LatencyMs: number;
  /** Nearest-rank p95 latency in milliseconds. */
  readonly p95LatencyMs: number;
  /** Sum of `costAmount` over events in the bucket. */
  readonly totalCostAmount: number;
  /** ISO-4217 currency. Single value per bucket. */
  readonly costCurrency: string;
}

/** Filter applied before aggregation. All fields optional except `tenantId`. */
export interface UsageAggregationFilter {
  readonly tenantId: string;
  /** Optional adapter filter; when set, only events with this `adapterId` count. */
  readonly adapterId?: string;
  /** Optional inclusive start of the window (ISO-8601). */
  readonly sinceTimestamp?: string;
  /** Optional exclusive end of the window (ISO-8601). */
  readonly untilTimestamp?: string;
}

/**
 * Thrown when a bucket would mix currencies. Tenants are single-
 * currency in v1; this guard catches future drift.
 */
export class UsageAggregationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageAggregationError';
  }
}

/**
 * Aggregate a flat event array into per-bucket rollups. Bucket key is
 * `(tenantId, adapterId, modality)`. Events outside the filter window
 * are dropped silently. Rollups are returned in stable order: events
 * are first filtered + sorted by timestamp, then bucketed in
 * insertion-order of first-seen `(adapterId, modality)`.
 *
 * Nearest-rank percentile: for `n` sorted latencies and percentile
 * `p ∈ [0, 100]`, the percentile is the element at index
 * `ceil((p/100) * n) - 1`, clamped to `[0, n-1]`.
 */
export function aggregateUsage(
  events: readonly AdapterUsageEvent[],
  filter: UsageAggregationFilter,
): readonly UsageRollup[] {
  // 1 — filter by tenantId / adapterId / time window.
  const filtered: AdapterUsageEvent[] = [];
  for (const e of events) {
    if (e.tenantId !== filter.tenantId) continue;
    if (filter.adapterId !== undefined && e.adapterId !== filter.adapterId) continue;
    if (filter.sinceTimestamp !== undefined && e.timestamp < filter.sinceTimestamp) continue;
    if (filter.untilTimestamp !== undefined && e.timestamp >= filter.untilTimestamp) continue;
    filtered.push(e);
  }

  if (filtered.length === 0) return [];

  // 2 — sort by timestamp ascending (ISO-8601 lex order == chronological).
  filtered.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

  // 3 — bucket by (adapterId, modality). Preserve insertion order via Map.
  const buckets = new Map<string, AdapterUsageEvent[]>();
  for (const e of filtered) {
    const key = `${e.adapterId}::${e.modality}`;
    const existing = buckets.get(key);
    if (existing === undefined) {
      buckets.set(key, [e]);
    } else {
      existing.push(e);
    }
  }

  // 4 — roll up each bucket.
  const rollups: UsageRollup[] = [];
  for (const [, bucketEvents] of buckets) {
    rollups.push(rollupBucket(filter.tenantId, bucketEvents));
  }
  return rollups;
}

function rollupBucket(tenantId: string, events: readonly AdapterUsageEvent[]): UsageRollup {
  // events is non-empty by construction (only created when first event lands).
  const first = events[0] as AdapterUsageEvent;
  const adapterId = first.adapterId;
  const modality = first.modality;
  const currency = first.costCurrency;
  let totalCost = 0;
  let successCount = 0;
  let failedCount = 0;
  let killedCount = 0;
  const latencies: number[] = [];
  for (const e of events) {
    if (e.costCurrency !== currency) {
      throw new UsageAggregationError(
        `aggregateUsage: bucket (${tenantId}, ${adapterId}, ${modality}) mixes currencies '${currency}' and '${e.costCurrency}'`,
      );
    }
    totalCost += e.costAmount;
    latencies.push(e.latencyMs);
    if (e.outcome === 'success') successCount += 1;
    else if (e.outcome === 'failed') failedCount += 1;
    else killedCount += 1;
  }
  // sentinel — unused otherwise; keeps the linter from flagging
  // currency as never-reassigned (it is, in the loop above, but only
  // to detect drift).
  void currency;
  latencies.sort((a, b) => a - b);
  return {
    tenantId,
    adapterId,
    modality,
    count: events.length,
    successCount,
    failedCount,
    killedCount,
    p50LatencyMs: nearestRankPercentile(latencies, 50),
    p95LatencyMs: nearestRankPercentile(latencies, 95),
    totalCostAmount: totalCost,
    costCurrency: first.costCurrency,
  };
}

/**
 * Nearest-rank percentile on a SORTED ascending numeric array.
 * `p ∈ [0, 100]`. For `n = arr.length`:
 *   - returns `0` if `n === 0` (the aggregator never calls with empty)
 *   - otherwise returns `arr[clamp(ceil((p/100)*n) - 1, 0, n-1)]`
 */
function nearestRankPercentile(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return 0;
  const rank = Math.ceil((p / 100) * n) - 1;
  const idx = rank < 0 ? 0 : rank >= n ? n - 1 : rank;
  return sortedAsc[idx] as number;
}
