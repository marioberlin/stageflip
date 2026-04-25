// packages/import-pptx/src/assets/resolve.ts
// T-243 stub. Tests pin the contract; implementation lands in the next
// commit on this branch.

import type { CanonicalSlideTree } from '../types.js';
import type { ZipEntries } from '../zip.js';
import type { AssetStorage } from './types.js';

/**
 * Walk a parser-side tree, upload every `ParsedAssetRef.unresolved` byte
 * payload through `storage`, and return a new tree where those refs are
 * rewritten as schema-typed `{ kind: 'resolved', ref: 'asset:<id>' }`.
 * Drops `LF-PPTX-UNRESOLVED-ASSET` flags; emits `LF-PPTX-MISSING-ASSET-BYTES`
 * for refs whose ZIP entry is absent. Idempotent via `tree.assetsResolved`.
 */
export async function resolveAssets(
  _tree: CanonicalSlideTree,
  _entries: ZipEntries,
  _storage: AssetStorage,
): Promise<CanonicalSlideTree> {
  throw new Error('resolveAssets: not implemented (T-243)');
}
