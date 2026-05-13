// packages/marketplace-registry/src/storage/in-memory.test.ts
// T-536 — Test coverage for `InMemoryStorageAdapter`.

import { describe, expect, it } from 'vitest';

import { InMemoryStorageAdapter } from './in-memory.js';
import { STORAGE_KEYS } from './storage.js';

describe('InMemoryStorageAdapter', () => {
  it('round-trips archive bytes', async () => {
    const s = new InMemoryStorageAdapter();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const key = STORAGE_KEYS.archive('stageflip', 'news-pro', '1.0.0');
    await s.putArchive(key, bytes);
    const got = await s.getArchive(key);
    expect(got).not.toBeNull();
    expect(Array.from(got as Uint8Array)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns null for missing archive', async () => {
    const s = new InMemoryStorageAdapter();
    const got = await s.getArchive('nonexistent/key');
    expect(got).toBeNull();
  });

  it('round-trips manifest JSON', async () => {
    const s = new InMemoryStorageAdapter();
    const key = STORAGE_KEYS.manifest('stageflip', 'news-pro', '1.0.0');
    await s.putManifest(key, '{"id":"news-pro"}');
    expect(await s.getManifest(key)).toBe('{"id":"news-pro"}');
  });

  it('returns null for missing manifest', async () => {
    const s = new InMemoryStorageAdapter();
    expect(await s.getManifest('nonexistent/key')).toBeNull();
  });

  it('listKeys matches by prefix', async () => {
    const s = new InMemoryStorageAdapter();
    await s.putArchive('archives/stageflip/news-pro/1.0.0/archive.sfpack', new Uint8Array([1]));
    await s.putArchive('archives/stageflip/news-pro/1.1.0/archive.sfpack', new Uint8Array([2]));
    await s.putArchive('archives/other/different/1.0.0/archive.sfpack', new Uint8Array([3]));
    await s.putManifest('manifests/stageflip/news-pro/1.0.0/manifest.json', '{}');

    const stageflip = await s.listKeys('archives/stageflip/');
    expect(stageflip.length).toBe(2);
    expect([...stageflip].sort()).toEqual([
      'archives/stageflip/news-pro/1.0.0/archive.sfpack',
      'archives/stageflip/news-pro/1.1.0/archive.sfpack',
    ]);

    const manifests = await s.listKeys('manifests/');
    expect(manifests.length).toBe(1);
  });

  it('listKeys returns empty array on no match', async () => {
    const s = new InMemoryStorageAdapter();
    const empty = await s.listKeys('nothing/here/');
    expect(empty).toEqual([]);
  });

  it('signedUrl encodes key + ttl', async () => {
    const s = new InMemoryStorageAdapter();
    const key = STORAGE_KEYS.archive('stageflip', 'news-pro', '1.0.0');
    await s.putArchive(key, new Uint8Array([1]));
    const url = await s.signedUrl(key, 300);
    expect(url).toBe('inmem://archive/archives/stageflip/news-pro/1.0.0/archive.sfpack?ttl=300');
  });

  it('defensive-copies on put so caller mutation does not affect store', async () => {
    const s = new InMemoryStorageAdapter();
    const bytes = new Uint8Array([1, 2, 3]);
    const key = STORAGE_KEYS.archive('p', 'i', '1.0.0');
    await s.putArchive(key, bytes);
    bytes[0] = 99;
    const got = await s.getArchive(key);
    expect((got as Uint8Array)[0]).toBe(1);
  });
});
