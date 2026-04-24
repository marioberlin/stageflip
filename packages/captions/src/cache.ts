// packages/captions/src/cache.ts
// Default in-memory TranscriptCache. Production wiring can plug in a
// disk-backed or Redis-backed implementation behind the same contract.
// Tests use this directly.

import { cacheKeyString } from './hash.js';
import type { CacheKey, Transcript, TranscriptCache } from './types.js';

/** Create a fresh in-memory cache. Isolated instances don't share state. */
export function createMemoryCache(): TranscriptCache {
  const store = new Map<string, Transcript>();
  return {
    async get(key: CacheKey): Promise<Transcript | undefined> {
      return store.get(cacheKeyString(key));
    },
    async set(key: CacheKey, value: Transcript): Promise<void> {
      store.set(cacheKeyString(key), value);
    },
  };
}
