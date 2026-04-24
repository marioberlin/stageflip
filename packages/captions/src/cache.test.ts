// packages/captions/src/cache.test.ts
// Coverage for the default memory TranscriptCache.

import { describe, expect, it } from 'vitest';

import { createMemoryCache } from './cache.js';
import type { Transcript } from './types.js';

const keyA = { sha256: 'aa', language: 'en' } as const;
const keyB = { sha256: 'bb', language: 'en' } as const;

const transcript = (text: string): Transcript => ({
  language: 'en',
  words: [{ text, startMs: 0, endMs: 300 }],
});

describe('createMemoryCache', () => {
  it('returns undefined on a miss', async () => {
    const cache = createMemoryCache();
    expect(await cache.get(keyA)).toBeUndefined();
  });

  it('stores + retrieves by key', async () => {
    const cache = createMemoryCache();
    await cache.set(keyA, transcript('hello'));
    expect(await cache.get(keyA)).toEqual(transcript('hello'));
  });

  it('treats different keys as distinct entries', async () => {
    const cache = createMemoryCache();
    await cache.set(keyA, transcript('a'));
    await cache.set(keyB, transcript('b'));
    expect((await cache.get(keyA))?.words[0]?.text).toBe('a');
    expect((await cache.get(keyB))?.words[0]?.text).toBe('b');
  });

  it('keeps separate state across independent cache instances', async () => {
    const first = createMemoryCache();
    const second = createMemoryCache();
    await first.set(keyA, transcript('only in first'));
    expect(await second.get(keyA)).toBeUndefined();
  });
});
