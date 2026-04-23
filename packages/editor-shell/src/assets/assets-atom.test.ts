// packages/editor-shell/src/assets/assets-atom.test.ts

import { createStore } from 'jotai';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addAssetAtom,
  assetsAtom,
  removeAssetAtom,
  replaceAssetsAtom,
  selectedAssetAtom,
  selectedAssetIdAtom,
} from './assets-atom';
import type { Asset } from './types';

function makeAsset(overrides: Partial<Asset> = {}): Omit<Asset, 'ref'> {
  return {
    id: overrides.id ?? 'abc',
    kind: overrides.kind ?? 'image',
    name: overrides.name ?? 'test.png',
    url: overrides.url ?? 'https://example.test/test.png',
    addedAt: overrides.addedAt ?? 0,
    ...(overrides.thumbnailUrl !== undefined ? { thumbnailUrl: overrides.thumbnailUrl } : {}),
    ...(overrides.sizeBytes !== undefined ? { sizeBytes: overrides.sizeBytes } : {}),
  };
}

afterEach(() => {
  // Jotai stores are created per-test; nothing global to clean up.
});

describe('assetsAtom', () => {
  it('starts empty', () => {
    const store = createStore();
    expect(store.get(assetsAtom)).toEqual([]);
  });

  it('addAssetAtom appends and derives ref', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    const list = store.get(assetsAtom);
    expect(list).toHaveLength(1);
    expect(list[0]?.ref).toBe('asset:a1');
  });

  it('addAssetAtom throws on duplicate id', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'dup' }));
    expect(() => store.set(addAssetAtom, makeAsset({ id: 'dup' }))).toThrow(/already registered/);
  });

  it('removeAssetAtom removes by id and clears selection', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    store.set(addAssetAtom, makeAsset({ id: 'a2' }));
    store.set(selectedAssetIdAtom, 'a1');
    store.set(removeAssetAtom, 'a1');
    expect(store.get(assetsAtom).map((a) => a.id)).toEqual(['a2']);
    expect(store.get(selectedAssetIdAtom)).toBeNull();
  });

  it('removeAssetAtom is a no-op for missing ids', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    store.set(removeAssetAtom, 'never');
    expect(store.get(assetsAtom)).toHaveLength(1);
  });

  it('replaceAssetsAtom overwrites', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    const next: Asset[] = [
      {
        id: 'z',
        ref: 'asset:z',
        kind: 'video',
        name: 'clip',
        url: 'blob:http://x/y',
        addedAt: 1,
      },
    ];
    store.set(replaceAssetsAtom, next);
    expect(store.get(assetsAtom)).toEqual(next);
  });

  it('selectedAssetAtom resolves the focused record', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    store.set(selectedAssetIdAtom, 'a1');
    expect(store.get(selectedAssetAtom)?.id).toBe('a1');
  });

  it('selectedAssetAtom is undefined when no id is focused', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    expect(store.get(selectedAssetAtom)).toBeUndefined();
  });

  it('selectedAssetAtom is undefined when the focused id no longer resolves', () => {
    const store = createStore();
    store.set(addAssetAtom, makeAsset({ id: 'a1' }));
    store.set(selectedAssetIdAtom, 'gone');
    expect(store.get(selectedAssetAtom)).toBeUndefined();
  });
});
