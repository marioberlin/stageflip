// packages/editor-shell/src/assets/assets-atom.ts
// Jotai atom + derived selectors for the editor's in-memory asset registry.

/**
 * The asset registry is an append-oriented list of `Asset` entries. The
 * editor never mutates existing entries in place — add, remove, or
 * replace by id. A `selectedAssetIdAtom` tracks the browser panel's
 * focused row so right-click + drag operations read a single source of
 * truth.
 *
 * Storage is deliberately in-memory for Phase 6. A future task can swap
 * the base atom for a persisted storage adapter without changing call
 * sites — `addAssetAtom` and friends are the only write points.
 */

import { type Atom, atom } from 'jotai';
import type { Asset } from './types';

export const assetsAtom = atom<ReadonlyArray<Asset>>([]);

/**
 * The currently focused asset in the browser panel. `null` when no row
 * is focused (fresh mount, empty registry, or after a deletion).
 */
export const selectedAssetIdAtom = atom<string | null>(null);

/**
 * Derived: the focused asset's full record, or `undefined` when no row
 * is focused or the focused id no longer resolves (e.g. after removal).
 */
export const selectedAssetAtom: Atom<Asset | undefined> = atom((get) => {
  const id = get(selectedAssetIdAtom);
  if (id === null) return undefined;
  return get(assetsAtom).find((a) => a.id === id);
});

/**
 * Write-only: append a new asset to the registry. Throws when the id is
 * already registered — callers that want upsert semantics should call
 * `removeAssetAtom` first. The ref is derived from the id so callers
 * never need to format it manually.
 */
export const addAssetAtom = atom(null, (get, set, asset: Omit<Asset, 'ref'>): void => {
  const existing = get(assetsAtom);
  if (existing.some((a) => a.id === asset.id)) {
    throw new Error(`asset id already registered: ${asset.id}`);
  }
  const full: Asset = { ...asset, ref: `asset:${asset.id}` };
  set(assetsAtom, [...existing, full]);
});

/** Write-only: remove an asset by id. No-op when the id is not present. */
export const removeAssetAtom = atom(null, (get, set, id: string): void => {
  const next = get(assetsAtom).filter((a) => a.id !== id);
  set(assetsAtom, next);
  if (get(selectedAssetIdAtom) === id) set(selectedAssetIdAtom, null);
});

/**
 * Write-only: replace the whole registry. Used by the legacy-import
 * flow when a freshly imported document carries its own asset
 * manifest. Callers responsible for freeing any object-URL resources
 * in the previous list.
 */
export const replaceAssetsAtom = atom(null, (_get, set, assets: ReadonlyArray<Asset>): void => {
  set(assetsAtom, assets);
});
