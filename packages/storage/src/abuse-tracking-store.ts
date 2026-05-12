// packages/storage/src/abuse-tracking-store.ts
// T-458 — AbuseTrackingStore facet. Sibling to TenantSettingsStore +
// TenantCostTrackerStore + AudienceResultsStore. Tracks per-source
// rate-limit-refusal hits in a sliding window; promotes a source to a
// flagged state with an escalating cooldown when the hit threshold is
// crossed.
//
// Five-method contract:
//   - recordHit(source)                 — append a hit at `now`.
//   - getCounter(source)                — { hits, windowStart } AFTER
//                                         pruning expired entries.
//   - flag(source, level)               — set/refresh the source's flag;
//                                         cooldown duration looked up
//                                         from `ABUSE_COOLDOWN_MS`.
//   - getFlag(source)                   — current flag (level 0 if
//                                         unflagged or expired); never
//                                         null.
//   - cleanup(beforeTimestamp)          — drop counters + flags strictly
//                                         older than `beforeTimestamp`.
//
// Production wiring uses InMemoryAbuseTrackingStore; the Firestore-
// backed implementation lands in T-474 and mirrors the same
// 3-adapter pattern as TenantSettingsStore (T-411a) /
// TenantCostTrackerStore (T-443).

import {
  ABUSE_COOLDOWN_MS,
  type AbuseCounter,
  type AbuseFlag,
  type AbuseSource,
  DEFAULT_ABUSE_THRESHOLD,
  DEFAULT_ABUSE_WINDOW_MS,
} from './abuse-tracking.js';

/**
 * Storage facet for per-source abuse tracking. The interface accepts
 * `AbuseSource` (a discriminated union of voter-token + IP); concrete
 * adapters key the in-memory map / Firestore document on a stable
 * concatenation of `kind` + `value`.
 */
export interface AbuseTrackingStore {
  /**
   * Hit threshold inside the sliding window before the source becomes
   * eligible for flagging. Exposed on the interface so consuming
   * limiters can compute escalation locally without re-asking for
   * configuration. Implementations return the value passed at
   * construction.
   */
  readonly threshold: number;

  /**
   * Append a single rate-limit refusal hit for `source` at the store's
   * current `now`. Sliding-window pruning is performed lazily inside
   * `getCounter`; `recordHit` itself is O(1) amortised (the in-memory
   * impl pushes onto an array; pruning happens on next read).
   */
  recordHit(source: AbuseSource): Promise<void>;

  /**
   * Snapshot of the source's hit accumulator AFTER pruning entries that
   * fall outside the sliding window. Returns `{ hits: 0, windowStart: now() }`
   * for an unseen source.
   */
  getCounter(source: AbuseSource): Promise<AbuseCounter>;

  /**
   * Set / refresh the source's flag. `level === 0` clears the flag;
   * any other level computes `expiresAt = now() + ABUSE_COOLDOWN_MS[level]`
   * and persists it. Callers determine the next level by reading
   * `getFlag(source)` first.
   */
  flag(source: AbuseSource, level: 0 | 1 | 2 | 3): Promise<void>;

  /**
   * Current flag for `source`. Returns `{ level: 0, expiresAt: 0 }` for
   * an unseen / unflagged source. Implementations DO NOT auto-expire
   * the level on read — the caller compares `expiresAt` against `now`
   * to determine cooldown freshness. This keeps the read pure.
   */
  getFlag(source: AbuseSource): Promise<AbuseFlag>;

  /**
   * Drop every counter + flag whose latest mutation is strictly older
   * than `beforeTimestamp` (millis). Intended for periodic GC; not on
   * the hot path. Returns the number of source rows removed.
   */
  cleanup(beforeTimestamp: number): Promise<number>;
}

/**
 * Construction options for the in-memory implementation. `now` follows
 * the T-443 / T-453 clock-injection pattern; production wiring uses
 * `() => Date.now()` and tests pass a controlled clock.
 */
export interface InMemoryAbuseTrackingStoreOptions {
  /** Wall-clock millis source. Default `() => Date.now()`. */
  readonly now?: () => number;
  /**
   * Sliding-window length in milliseconds for hit accumulation.
   * Default `DEFAULT_ABUSE_WINDOW_MS` (60 s).
   */
  readonly windowMs?: number;
  /**
   * Hit threshold inside the window before a source is eligible for
   * flagging. Default `DEFAULT_ABUSE_THRESHOLD` (10). The store does
   * NOT auto-flag on threshold crossing; the caller (rate limiter)
   * inspects `getCounter(...)` and calls `flag(...)` itself.
   */
  readonly threshold?: number;
}

interface SourceState {
  hits: number[];
  flag: AbuseFlag;
  lastTouchedAt: number;
}

function sourceKey(source: AbuseSource): string {
  return `${source.kind}${source.value}`;
}

/**
 * Process-local AbuseTrackingStore. Single-process, not thread-safe in
 * the worker-thread sense; fine for the audience-backend service
 * (Cloud Run replicas each have their own counter — abuse is bursty +
 * scoped to a session, so per-replica tracking is acceptable for v1.
 * The Firestore-backed impl in T-474 unifies across replicas).
 */
export class InMemoryAbuseTrackingStore implements AbuseTrackingStore {
  private readonly rows = new Map<string, SourceState>();
  private readonly now: () => number;
  /** Public read-only — handy for callers that need the same window. */
  readonly windowMs: number;
  /** Public read-only — handy for callers that need the same threshold. */
  readonly threshold: number;

  constructor(options: InMemoryAbuseTrackingStoreOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.windowMs = options.windowMs ?? DEFAULT_ABUSE_WINDOW_MS;
    this.threshold = options.threshold ?? DEFAULT_ABUSE_THRESHOLD;
  }

  async recordHit(source: AbuseSource): Promise<void> {
    const t = this.now();
    const key = sourceKey(source);
    const row = this.rows.get(key);
    if (!row) {
      this.rows.set(key, {
        hits: [t],
        flag: { level: 0, expiresAt: 0 },
        lastTouchedAt: t,
      });
      return;
    }
    this.pruneHits(row, t);
    row.hits.push(t);
    row.lastTouchedAt = t;
  }

  async getCounter(source: AbuseSource): Promise<AbuseCounter> {
    const t = this.now();
    const key = sourceKey(source);
    const row = this.rows.get(key);
    if (!row || row.hits.length === 0) {
      return { hits: 0, windowStart: t };
    }
    this.pruneHits(row, t);
    if (row.hits.length === 0) {
      return { hits: 0, windowStart: t };
    }
    // The pruned hits array is non-empty here — `hits[0]` is therefore
    // a `number`, but TypeScript's `noUncheckedIndexedAccess` typing
    // still widens to `number | undefined`. The fallback is unreachable.
    const windowStart = row.hits[0] ?? t;
    return { hits: row.hits.length, windowStart };
  }

  async flag(source: AbuseSource, level: 0 | 1 | 2 | 3): Promise<void> {
    const t = this.now();
    const key = sourceKey(source);
    const cooldown = ABUSE_COOLDOWN_MS[level];
    const expiresAt = level === 0 ? 0 : t + cooldown;
    const row = this.rows.get(key);
    if (!row) {
      this.rows.set(key, {
        hits: [],
        flag: { level, expiresAt },
        lastTouchedAt: t,
      });
      return;
    }
    row.flag = { level, expiresAt };
    row.lastTouchedAt = t;
  }

  async getFlag(source: AbuseSource): Promise<AbuseFlag> {
    const key = sourceKey(source);
    const row = this.rows.get(key);
    if (!row) {
      return { level: 0, expiresAt: 0 };
    }
    return row.flag;
  }

  async cleanup(beforeTimestamp: number): Promise<number> {
    let removed = 0;
    for (const [key, row] of this.rows) {
      if (row.lastTouchedAt < beforeTimestamp) {
        this.rows.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** Test-only: reset all state. */
  reset(): void {
    this.rows.clear();
  }

  /** Test-only: number of tracked sources. */
  size(): number {
    return this.rows.size;
  }

  private pruneHits(row: SourceState, t: number): void {
    const cutoff = t - this.windowMs;
    let drop = 0;
    while (drop < row.hits.length) {
      const head = row.hits[drop];
      if (head === undefined || head >= cutoff) break;
      drop += 1;
    }
    if (drop > 0) row.hits.splice(0, drop);
  }
}
