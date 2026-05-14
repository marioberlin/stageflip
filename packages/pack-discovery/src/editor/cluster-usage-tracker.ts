// packages/pack-discovery/src/editor/cluster-usage-tracker.ts
// T-546 — Editor-side observation surface that records which clusters
// the tenant has clips on stage from. The recommendation ranker
// (`recommendation-ranker.ts`) consults it to derive the
// `clustersInUse` signal passed into T-504's `recommendPacks`.
//
// The tracker is intentionally tiny + synchronous: callers wire it to
// editor document events (clip add / remove / clear) and it accumulates
// counts + most-recent-ms timestamps per cluster. It does NOT subscribe
// to anything; the editor pushes events in.

/** One per-clip usage row. Internal to the tracker. */
export interface DocumentClusterUsage {
  readonly clipKind: string;
  readonly clusterId: string;
  readonly addedAtMs: number;
}

/** Aggregate per-cluster report. */
export interface ClusterUsageReport {
  readonly clusterId: string;
  readonly count: number;
  readonly mostRecentMs: number;
}

/**
 * Mutable in-memory tracker of cluster usage in the editor document.
 *
 * - `recordClipAdded(kind, cluster, atMs?)` — add one usage row.
 * - `recordClipRemoved(cluster)` — decrement the most recent matching
 *   row for that cluster (or no-op if none).
 * - `reset()` — clear every row.
 * - `reportByCluster()` — aggregate counts + most-recent-ms,
 *   sorted by count DESC then clusterId ASC.
 * - `clustersInUse()` — distinct cluster IDs in insertion order.
 */
export class ClusterUsageTracker {
  private readonly rows: DocumentClusterUsage[] = [];

  recordClipAdded(clipKind: string, clusterId: string, atMs?: number): void {
    const stamp = atMs ?? 0;
    this.rows.push({ clipKind, clusterId, addedAtMs: stamp });
  }

  /**
   * Decrement the most recent row for the supplied cluster. No-op when
   * the cluster has no rows. We pop the most-recent matching row so
   * `mostRecentMs` correctly reflects the next-most-recent on the next
   * report.
   */
  recordClipRemoved(clusterId: string): void {
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      const row = this.rows[i];
      if (row !== undefined && row.clusterId === clusterId) {
        this.rows.splice(i, 1);
        return;
      }
    }
  }

  reset(): void {
    this.rows.length = 0;
  }

  reportByCluster(): readonly ClusterUsageReport[] {
    const bucket = new Map<string, { count: number; mostRecentMs: number }>();
    for (const row of this.rows) {
      const existing = bucket.get(row.clusterId);
      if (existing === undefined) {
        bucket.set(row.clusterId, { count: 1, mostRecentMs: row.addedAtMs });
      } else {
        existing.count += 1;
        if (row.addedAtMs > existing.mostRecentMs) existing.mostRecentMs = row.addedAtMs;
      }
    }
    const out: ClusterUsageReport[] = [];
    for (const [clusterId, agg] of bucket.entries()) {
      out.push({ clusterId, count: agg.count, mostRecentMs: agg.mostRecentMs });
    }
    out.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.clusterId < b.clusterId ? -1 : 1;
    });
    return out;
  }

  clustersInUse(): readonly string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of this.rows) {
      if (!seen.has(row.clusterId)) {
        seen.add(row.clusterId);
        out.push(row.clusterId);
      }
    }
    return out;
  }
}
