// packages/pack-discovery/src/editor/recommendation-cache.ts
// T-546 — TTL cache for editor recommendation results. The editor can
// re-rank on every keystroke / document change without thrashing the
// catalogue + recommender by routing reads through this cache.
//
// Cache keys are caller-defined strings; the editor typically builds
// them from a stable hash of the input (clustersInUse + installed).
// Entries expire when `now() - storedAtMs >= ttlMs`. An injected
// `now()` keeps the cache deterministic in tests.

import type { PackRecommendation } from '../recommender.js';

/** One cache row. */
export interface RecommendationCacheEntry {
  readonly key: string;
  readonly recommendations: readonly PackRecommendation[];
  readonly storedAtMs: number;
}

/** Constructor options for `RecommendationCache`. */
export interface RecommendationCacheOptions {
  readonly ttlMs: number;
  readonly now?: () => number;
}

/**
 * In-memory TTL cache keyed by caller-supplied strings. Methods:
 *
 * - `get(key)` — returns the cached recommendations, or `null` if the
 *   key is absent / expired. Expired entries are evicted on read.
 * - `set(key, recommendations)` — stamp the entry with the current
 *   `now()` and store it.
 * - `clear()` — drop every entry.
 * - `size()` — count of non-expired entries (lazily evicts on call).
 */
export class RecommendationCache {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, RecommendationCacheEntry>();

  constructor(opts: RecommendationCacheOptions) {
    this.ttlMs = opts.ttlMs;
    this.now = opts.now ?? (() => Date.now());
  }

  get(key: string): readonly PackRecommendation[] | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (this.now() - entry.storedAtMs >= this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.recommendations;
  }

  set(key: string, recommendations: readonly PackRecommendation[]): void {
    this.entries.set(key, {
      key,
      recommendations,
      storedAtMs: this.now(),
    });
  }

  clear(): void {
    this.entries.clear();
  }

  /** Count of non-expired entries; expired ones are dropped during the sweep. */
  size(): number {
    const cutoff = this.now() - this.ttlMs;
    for (const [key, entry] of this.entries.entries()) {
      if (entry.storedAtMs <= cutoff) this.entries.delete(key);
    }
    return this.entries.size;
  }
}
