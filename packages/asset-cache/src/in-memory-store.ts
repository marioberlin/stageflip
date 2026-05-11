// packages/asset-cache/src/in-memory-store.ts
// Default in-memory `AssetCacheStore` implementation. `Map`-backed; no
// eviction, no concurrency, no transport. Each instance is isolated —
// independent stores do not share state. Mirrors the captions package's
// `createMemoryCache()` semantics, generalized to any payload type.
//
// Production callers wrap this (or implement `AssetCacheStore<T>` directly)
// to add LRU / TTL / multi-tier behaviour; the contract package stays
// minimal so backing stores compose freely.

import type { AssetCacheStore } from './store.js';

/**
 * In-memory `AssetCacheStore<T>` backed by a single `Map<string, T>`.
 * Unbounded — production callers wrap with eviction policy.
 */
export class InMemoryAssetCacheStore<T> implements AssetCacheStore<T> {
  private readonly store: Map<string, T> = new Map();

  async get(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
