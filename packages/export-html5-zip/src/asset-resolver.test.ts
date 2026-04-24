// packages/export-html5-zip/src/asset-resolver.test.ts
// T-203b — InMemoryAssetResolver behaviour.

import type { AssetRef } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { InMemoryAssetResolver } from './asset-resolver.js';

describe('InMemoryAssetResolver', () => {
  it('resolves a registered ref', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const resolver = new InMemoryAssetResolver([['asset:x' as AssetRef, bytes]]);
    await expect(resolver.resolve('asset:x' as AssetRef)).resolves.toEqual(bytes);
  });

  it('throws on an unknown ref', async () => {
    const resolver = new InMemoryAssetResolver();
    await expect(resolver.resolve('asset:missing' as AssetRef)).rejects.toThrow(/not found/);
  });

  it('supports set(ref, bytes) for post-construction additions', async () => {
    const resolver = new InMemoryAssetResolver();
    resolver.set('asset:x' as AssetRef, new Uint8Array([9]));
    await expect(resolver.resolve('asset:x' as AssetRef)).resolves.toEqual(new Uint8Array([9]));
  });

  it('set() returns the resolver for chaining', () => {
    const resolver = new InMemoryAssetResolver();
    expect(resolver.set('asset:x' as AssetRef, new Uint8Array())).toBe(resolver);
  });
});
