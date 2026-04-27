// packages/storage-firebase/src/region-router.ts
// T-271 — Region-aware factory that routes a tenant's Firestore + asset bucket
// based on `org.region`. Stub scaffold (filled in by T-271 commit 3).

import type { Org } from '@stageflip/auth-schema';
import type { AssetStorage } from '@stageflip/import-pptx';
import type { BucketLike } from './asset-storage.js';

export type { BucketLike };

/**
 * Structural shape of `firebase-admin/firestore` Firestore the router needs.
 * Routing itself does not call Firestore methods; consumers do. The router
 * just hands back the right instance.
 */
export interface FirestoreLike {
  // Empty: structural typing — the real `Firestore` from firebase-admin
  // satisfies this and any structural mock does too.
  readonly [k: string]: unknown;
}

export interface RegionRouterOptions {
  /** US (`(default)`) Firestore. Required. */
  readonly defaultFirestore: FirestoreLike;
  /** EU (`eu-west`) Firestore. Required if any org has `region: 'eu'`. */
  readonly euFirestore?: FirestoreLike;
  /** US assets bucket. Defaults to {@link DEFAULT_US_BUCKET} (resolved by caller). */
  readonly defaultBucket?: BucketLike;
  /** EU assets bucket. Required if any org has `region: 'eu'` AND asset routing is used. */
  readonly euBucket?: BucketLike;
}

export interface RegionRouter {
  getFirestoreForOrg(org: Pick<Org, 'region'>): FirestoreLike;
  getStorageBucketForOrg(org: Pick<Org, 'region'>): BucketLike;
  getAssetStorageForOrg(org: Pick<Org, 'region'>): AssetStorage;
}

/** Default US assets bucket name. Override via env in callers. */
export const DEFAULT_US_BUCKET = 'stageflip-assets';
/** Default EU assets bucket name. Override via env in callers. */
export const DEFAULT_EU_BUCKET = 'stageflip-eu-assets';

/**
 * Stub — filled in by T-271 commit 3 (`feat(storage-firebase): region-router
 * factory + per-region adapter cache`). Tests fail until then.
 */
export function createRegionRouter(_opts: RegionRouterOptions): RegionRouter {
  throw new Error('createRegionRouter — not implemented (T-271 commit 3 pending)');
}
