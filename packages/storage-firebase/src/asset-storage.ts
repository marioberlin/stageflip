// packages/storage-firebase/src/asset-storage.ts
// Concrete `AssetStorage` adapter wrapping a Firebase Admin Storage bucket.
// The `AssetStorage` contract is defined in `@stageflip/import-pptx`; T-243's
// `resolveAssets` calls into this adapter to upload PPTX media bytes.
//
// References (CLAUDE.md §7 — public docs only):
//   https://firebase.google.com/docs/storage/admin/start
//   https://googleapis.dev/nodejs/storage/latest/Bucket.html

import type { AssetStorage } from '@stageflip/import-pptx';

/**
 * The slice of the firebase-admin / @google-cloud/storage `Bucket` API the
 * adapter actually uses. Declaring it locally keeps unit tests free of any
 * Firebase mock framework — callers in production pass a real `Bucket`,
 * which structurally satisfies this shape.
 */
export interface BucketLike {
  file(name: string): FileLike;
}

/** Subset of `@google-cloud/storage` `File` we use. */
export interface FileLike {
  save(
    data: Buffer | Uint8Array,
    options?: { contentType?: string; resumable?: boolean; metadata?: unknown },
  ): Promise<unknown>;
}

/** Factory options for `createFirebaseAssetStorage`. */
export interface FirebaseAssetStorageOptions {
  /** Bucket to write to. Use `getStorage().bucket()` for the default. */
  bucket: BucketLike;
  /**
   * Path prefix prepended to every uploaded asset. Defaults to
   * `pptx-imports`. The full storage path is
   * `{pathPrefix}/{contentHash.slice(0, 21)}`.
   */
  pathPrefix?: string;
  /**
   * Trim length for the storage id derived from `contentHash`. Defaults to
   * 21 (matches `idSchema` from `@stageflip/schema`). Lowering increases
   * collision risk; raising widens the storage path. The full hash stays in
   * the storage object's metadata for traceability.
   */
  idLength?: number;
}

const DEFAULT_PATH_PREFIX = 'pptx-imports';
const DEFAULT_ID_LENGTH = 21;

/**
 * Build an `AssetStorage` that uploads PPTX media bytes to a Firebase Storage
 * bucket. The returned implementation is content-addressed: identical bytes
 * (same `contentHash`) always resolve to the same storage path, so the
 * importer's dedup-by-hash logic translates directly to dedup-by-path on the
 * Firebase side.
 */
export function createFirebaseAssetStorage(opts: FirebaseAssetStorageOptions): AssetStorage {
  const pathPrefix = opts.pathPrefix ?? DEFAULT_PATH_PREFIX;
  const idLength = opts.idLength ?? DEFAULT_ID_LENGTH;

  return {
    async put(content, putOpts) {
      const id = putOpts.contentHash.slice(0, idLength);
      const path = `${pathPrefix}/${id}`;
      await opts.bucket.file(path).save(content, {
        contentType: putOpts.contentType,
        resumable: false,
        metadata: { metadata: { contentHash: putOpts.contentHash } },
      });
      return { id };
    },
  };
}
