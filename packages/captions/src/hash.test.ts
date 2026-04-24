// packages/captions/src/hash.test.ts
// Cache-key derivation + serialisation.

import { describe, expect, it } from 'vitest';

import { cacheKeyString, deriveCacheKey } from './hash.js';
import type { AudioSource } from './types.js';

describe('deriveCacheKey', () => {
  it('derives a 64-char hex sha256 for byte input', async () => {
    const source: AudioSource = { kind: 'bytes', bytes: new Uint8Array([1, 2, 3]) };
    const key = await deriveCacheKey(source);
    expect(key.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(key.language).toBe('auto');
  });

  it('honors the language hint', async () => {
    const source: AudioSource = { kind: 'bytes', bytes: new Uint8Array([1]) };
    const key = await deriveCacheKey(source, 'de');
    expect(key.language).toBe('de');
  });

  it('returns distinct hashes for different byte payloads', async () => {
    const a = await deriveCacheKey({ kind: 'bytes', bytes: new Uint8Array([1, 2, 3]) });
    const b = await deriveCacheKey({ kind: 'bytes', bytes: new Uint8Array([1, 2, 4]) });
    expect(a.sha256).not.toBe(b.sha256);
  });

  it('returns the same hash for identical byte payloads', async () => {
    const a = await deriveCacheKey({ kind: 'bytes', bytes: new Uint8Array([9, 9, 9]) });
    const b = await deriveCacheKey({ kind: 'bytes', bytes: new Uint8Array([9, 9, 9]) });
    expect(a.sha256).toBe(b.sha256);
  });

  it('hashes url sources by utf-8 encoding of the URL string', async () => {
    const a = await deriveCacheKey({ kind: 'url', url: 'https://a.example/clip.mp3' });
    const b = await deriveCacheKey({ kind: 'url', url: 'https://a.example/clip.mp3' });
    const c = await deriveCacheKey({ kind: 'url', url: 'https://b.example/clip.mp3' });
    expect(a.sha256).toBe(b.sha256);
    expect(a.sha256).not.toBe(c.sha256);
  });
});

describe('cacheKeyString', () => {
  it('joins sha256 and language with "::"', () => {
    expect(cacheKeyString({ sha256: 'abc123', language: 'en' })).toBe('abc123::en');
  });

  it('distinguishes languages for the same bytes', () => {
    const a = cacheKeyString({ sha256: 'deadbeef', language: 'en' });
    const b = cacheKeyString({ sha256: 'deadbeef', language: 'de' });
    expect(a).not.toBe(b);
  });
});
