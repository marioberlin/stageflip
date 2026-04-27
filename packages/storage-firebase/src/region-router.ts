// packages/storage-firebase/src/region-router.ts
// T-271 — Region-aware factory that routes a tenant's Firestore + asset bucket
// based on `org.region`. The router is purely additive: existing consumers that
// pass a Firestore directly to `createFirebaseAssetStorage` are unaffected
// (AC #12). Consumers wanting per-tenant routing call `createRegionRouter` once
// at boot, then `router.getFirestoreForOrg(org)` / `router.getAssetStorageForOrg(org)`
// per request.

import type { Org } from '@stageflip/auth-schema';
import type { AssetStorage } from '@stageflip/import-pptx';
import { type BucketLike, createFirebaseAssetStorage } from './asset-storage.js';

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

type Region = Org['region'];

/**
 * Create a region-aware router. Per-region adapter instances are cached: a
 * second call to `getAssetStorageForOrg` for the same region returns the
 * same `AssetStorage` instance (AC #4) so callers don't accumulate adapters.
 *
 * The router rejects unknown region values (AC #3) — Zod's `regionSchema`
 * already forbids them at the parse boundary, but the runtime guard hardens
 * the security primitive against admin SDK writes that bypass schema
 * validation (e.g. raw `firestore.doc(...).set({ region: 'apac' })` from a
 * privileged script).
 */
export function createRegionRouter(opts: RegionRouterOptions): RegionRouter {
  const assetStorageCache = new Map<Region, AssetStorage>();

  function pickFirestore(region: Region): FirestoreLike {
    if (region === 'us') {
      return opts.defaultFirestore;
    }
    if (region === 'eu') {
      if (!opts.euFirestore) {
        throw new Error(
          'createRegionRouter: euFirestore is required to route EU orgs but was not injected.',
        );
      }
      return opts.euFirestore;
    }
    throw new Error(
      `createRegionRouter: unknown region "${String(region)}" — expected "us" | "eu".`,
    );
  }

  function pickBucket(region: Region): BucketLike {
    if (region === 'us') {
      if (!opts.defaultBucket) {
        throw new Error(
          'createRegionRouter: defaultBucket is required to route US asset storage but was not injected.',
        );
      }
      return opts.defaultBucket;
    }
    if (region === 'eu') {
      if (!opts.euBucket) {
        throw new Error(
          'createRegionRouter: euBucket is required to route EU asset storage but was not injected.',
        );
      }
      return opts.euBucket;
    }
    throw new Error(
      `createRegionRouter: unknown region "${String(region)}" — expected "us" | "eu".`,
    );
  }

  function getAssetStorage(region: Region): AssetStorage {
    const cached = assetStorageCache.get(region);
    if (cached) {
      return cached;
    }
    const bucket = pickBucket(region);
    const adapter = createFirebaseAssetStorage({ bucket });
    assetStorageCache.set(region, adapter);
    return adapter;
  }

  return {
    getFirestoreForOrg(org) {
      return pickFirestore(org.region);
    },
    getStorageBucketForOrg(org) {
      return pickBucket(org.region);
    },
    getAssetStorageForOrg(org) {
      return getAssetStorage(org.region);
    },
  };
}
