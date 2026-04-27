// packages/storage-firebase/src/index.ts
// Firebase-backed adapters for StageFlip's storage abstractions. Today: the
// `AssetStorage` adapter T-243's importer pipeline calls into, plus the
// region-aware router (T-271) that picks the right Firestore + bucket per
// `org.region`.

export { createFirebaseAssetStorage } from './asset-storage.js';
export type {
  BucketLike,
  FileLike,
  FirebaseAssetStorageOptions,
} from './asset-storage.js';
export {
  createRegionRouter,
  DEFAULT_EU_BUCKET,
  DEFAULT_US_BUCKET,
} from './region-router.js';
export type {
  FirestoreLike,
  RegionRouter,
  RegionRouterOptions,
} from './region-router.js';
