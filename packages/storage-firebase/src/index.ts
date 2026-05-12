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

// T-411a — TenantSettings Firestore facet (per-tenant frontier-enablement
// settings; see docs/tasks/T-411.md / T-411a.md).
export { createFirebaseTenantSettingsStore } from './tenant-settings.js';
export type {
  FirebaseTenantSettingsStoreOptions,
  FirestoreCollectionRefLike,
  FirestoreDocRefLike,
  FirestoreDocSnapshotLike,
  FirestoreQuerySnapshotLike,
  FirestoreTenantSettingsLike,
} from './tenant-settings.js';

// T-474 — Audience-results Firestore facet (per-session audience-event +
// aggregation persistence per ADR-009 §D5; mirrors the
// TenantSettingsStore pattern + uses the same region-router for EU
// residency).
export { createFirebaseAudienceResultsStore } from './audience-results.js';
export type {
  FirebaseAudienceResultsStoreOptions,
  FirestoreAudienceResultsLike,
  FirestoreCollectionRefLike as FirestoreAudienceCollectionRefLike,
  FirestoreDocRefLike as FirestoreAudienceDocRefLike,
  FirestoreDocSnapshotLike as FirestoreAudienceDocSnapshotLike,
  FirestoreQueryLike,
  FirestoreQuerySnapshotLike as FirestoreAudienceQuerySnapshotLike,
} from './audience-results.js';
