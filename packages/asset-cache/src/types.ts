// packages/asset-cache/src/types.ts
// Public types barrel. Re-exports the type surface so consumers can import
// from `@stageflip/asset-cache/types` if they prefer to keep type imports
// distinct from value imports. Identical to the surface re-exported from
// `index.ts` — `index.ts` is the canonical entry point.

export type { AssetCacheKey, CanonicalCacheKeyInput } from './cache-key.js';
export type { AssetCacheStore } from './store.js';
