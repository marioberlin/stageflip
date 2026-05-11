// packages/asset-cache/src/store.ts
// AssetCacheStore<T> — pluggable storage contract every asset-cache backend
// implements. The default in-memory implementation lives in `in-memory-store.ts`.
// AssetStorage-backed and CDN-mirrored adapters are downstream tasks (see
// docs/tasks/T-420.md "Out of scope"); they implement this interface.

/**
 * Pluggable contract for caching asset-gen output by string key. Keys are
 * typically produced by `cacheKeyString(deriveCacheKey(input))` but the
 * store accepts any string — modality bucketing is the caller's concern.
 *
 * All operations are async so backing stores that need network I/O
 * (Redis, CDN, AssetStorage) can implement the same interface as the
 * in-memory `Map`-backed default.
 */
export interface AssetCacheStore<T> {
  /** Return the cached value, or `undefined` if the key is unset. */
  get(key: string): Promise<T | undefined>;
  /** Set the value for the key. Overwrites any existing value. */
  set(key: string, value: T): Promise<void>;
  /** Return `true` if the key has a stored value, `false` otherwise. */
  has(key: string): Promise<boolean>;
}
