// packages/storage-firebase/src/index.ts
// Firebase-backed adapters for StageFlip's storage abstractions. Today: the
// `AssetStorage` adapter T-243's importer pipeline calls into.

export { createFirebaseAssetStorage } from './asset-storage.js';
export type {
  BucketLike,
  FileLike,
  FirebaseAssetStorageOptions,
} from './asset-storage.js';
