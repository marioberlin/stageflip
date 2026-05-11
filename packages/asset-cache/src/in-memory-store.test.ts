// packages/asset-cache/src/in-memory-store.test.ts
// Coverage for the default in-memory AssetCacheStore implementation.

import { describe, expect, it } from 'vitest';

import { InMemoryAssetCacheStore } from './in-memory-store.js';

interface Asset {
  readonly url: string;
  readonly bytes: number;
}

const asset = (url: string, bytes: number): Asset => ({ url, bytes });

describe('InMemoryAssetCacheStore', () => {
  it('returns undefined on a get for an unset key', async () => {
    const store = new InMemoryAssetCacheStore<Asset>();
    expect(await store.get('missing')).toBeUndefined();
  });

  it('returns false on has for an unset key', async () => {
    const store = new InMemoryAssetCacheStore<Asset>();
    expect(await store.has('missing')).toBe(false);
  });

  it('round-trips a set value via get', async () => {
    const store = new InMemoryAssetCacheStore<Asset>();
    await store.set('k1', asset('https://cdn/a', 100));
    expect(await store.get('k1')).toEqual(asset('https://cdn/a', 100));
  });

  it('returns true on has after set', async () => {
    const store = new InMemoryAssetCacheStore<Asset>();
    await store.set('k1', asset('https://cdn/a', 100));
    expect(await store.has('k1')).toBe(true);
  });

  it('overwrites an existing key on subsequent set', async () => {
    const store = new InMemoryAssetCacheStore<Asset>();
    await store.set('k1', asset('https://cdn/old', 100));
    await store.set('k1', asset('https://cdn/new', 200));
    expect(await store.get('k1')).toEqual(asset('https://cdn/new', 200));
  });

  it('treats different keys as distinct entries', async () => {
    const store = new InMemoryAssetCacheStore<Asset>();
    await store.set('k1', asset('a', 1));
    await store.set('k2', asset('b', 2));
    expect((await store.get('k1'))?.url).toBe('a');
    expect((await store.get('k2'))?.url).toBe('b');
  });

  it('keeps separate state across independent store instances', async () => {
    const first = new InMemoryAssetCacheStore<Asset>();
    const second = new InMemoryAssetCacheStore<Asset>();
    await first.set('k1', asset('only-in-first', 1));
    expect(await second.get('k1')).toBeUndefined();
    expect(await second.has('k1')).toBe(false);
  });

  it('supports any payload type via the generic parameter', async () => {
    const stringStore = new InMemoryAssetCacheStore<string>();
    await stringStore.set('s', 'hello');
    expect(await stringStore.get('s')).toBe('hello');

    const bytesStore = new InMemoryAssetCacheStore<Uint8Array>();
    await bytesStore.set('b', new Uint8Array([1, 2, 3]));
    expect(await bytesStore.get('b')).toEqual(new Uint8Array([1, 2, 3]));
  });
});
