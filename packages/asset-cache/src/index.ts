// packages/asset-cache/src/index.ts
// Public surface of `@stageflip/asset-cache`. Implements ADR-008 §D1's
// content-addressed cache key formula
// `sha256(canonicalize({ modality, model, voice, prompt, params, seed }))`
// plus a pluggable `AssetCacheStore<T>` contract with a `Map`-backed default.
//
// AssetStorage-backed adapters are downstream (see `docs/tasks/T-420.md`).
// Captions package migration is deferred (see `docs/tasks/T-420.md` "Migration
// tradeoff").

export { canonicalize } from './canonicalize.js';
export { cacheKeyString, deriveCacheKey, normalizePrompt } from './cache-key.js';
export { InMemoryAssetCacheStore } from './in-memory-store.js';
export type { AssetCacheKey, CanonicalCacheKeyInput } from './cache-key.js';
export type { AssetCacheStore } from './store.js';
