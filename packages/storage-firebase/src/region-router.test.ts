// packages/storage-firebase/src/region-router.test.ts
// T-271 AC #1–#5, #11 — region router routes Firestore + bucket per org.region.
// Adapter cache pinned (AC #4); injection-friendly constructor pinned (AC #5).

import { describe, expect, it } from 'vitest';
import type { Org } from '@stageflip/auth-schema';
import {
  createRegionRouter,
  type FirestoreLike,
  type BucketLike,
  DEFAULT_US_BUCKET,
  DEFAULT_EU_BUCKET,
} from './region-router.js';

function makeFirestore(label: string): FirestoreLike {
  // The label is just a tag for test identity comparisons; the structural
  // FirestoreLike contract has no behaviour required for routing tests.
  return { __label: label } as unknown as FirestoreLike;
}

function makeBucket(label: string): BucketLike {
  return {
    file(_name: string) {
      return { async save() {} };
    },
    __label: label,
  } as unknown as BucketLike;
}

const usOrg: Org = {
  id: 'org-us',
  name: 'US Org',
  slug: 'us-org',
  createdAt: 1730000000000,
  ownerId: 'user-1',
  plan: 'free',
  region: 'us',
};

const euOrg: Org = {
  id: 'org-eu',
  name: 'EU Org',
  slug: 'eu-org',
  createdAt: 1730000000000,
  ownerId: 'user-2',
  plan: 'free',
  region: 'eu',
};

describe('createRegionRouter — getFirestoreForOrg (AC #1, #2, #5)', () => {
  it('returns the default Firestore for region "us" (AC #1)', () => {
    const defaultFs = makeFirestore('default');
    const euFs = makeFirestore('eu-west');
    const router = createRegionRouter({ defaultFirestore: defaultFs, euFirestore: euFs });
    expect(router.getFirestoreForOrg(usOrg)).toBe(defaultFs);
  });

  it('returns the eu-west Firestore for region "eu" (AC #2)', () => {
    const defaultFs = makeFirestore('default');
    const euFs = makeFirestore('eu-west');
    const router = createRegionRouter({ defaultFirestore: defaultFs, euFirestore: euFs });
    expect(router.getFirestoreForOrg(euOrg)).toBe(euFs);
  });

  it('accepts dependency-injected Firestore instances (AC #5)', () => {
    const defaultFs = makeFirestore('default');
    const euFs = makeFirestore('eu-west');
    const router = createRegionRouter({ defaultFirestore: defaultFs, euFirestore: euFs });
    expect(router.getFirestoreForOrg(usOrg)).toBe(defaultFs);
    expect(router.getFirestoreForOrg(euOrg)).toBe(euFs);
  });
});

describe('createRegionRouter — defensive guard (AC #3)', () => {
  it('throws on unknown region values', () => {
    const router = createRegionRouter({
      defaultFirestore: makeFirestore('default'),
      euFirestore: makeFirestore('eu-west'),
    });
    const bogus = { ...usOrg, region: 'uk' as unknown as 'us' };
    expect(() => router.getFirestoreForOrg(bogus)).toThrow(/region/i);
  });

  it('throws when an EU org is queried but no euFirestore was injected', () => {
    const router = createRegionRouter({ defaultFirestore: makeFirestore('default') });
    expect(() => router.getFirestoreForOrg(euOrg)).toThrow(/eu/i);
  });
});

describe('createRegionRouter — adapter cache (AC #4)', () => {
  it('returns the same Firestore instance across calls for the same region', () => {
    const defaultFs = makeFirestore('default');
    const euFs = makeFirestore('eu-west');
    const router = createRegionRouter({ defaultFirestore: defaultFs, euFirestore: euFs });
    const a = router.getFirestoreForOrg(euOrg);
    const b = router.getFirestoreForOrg({ ...euOrg, id: 'org-eu-2' });
    expect(a).toBe(b);
  });

  it('caches per-region asset-storage adapters (AC #4)', () => {
    const router = createRegionRouter({
      defaultFirestore: makeFirestore('default'),
      euFirestore: makeFirestore('eu-west'),
      defaultBucket: makeBucket('us-bucket'),
      euBucket: makeBucket('eu-bucket'),
    });
    const a = router.getAssetStorageForOrg(usOrg);
    const b = router.getAssetStorageForOrg({ ...usOrg, id: 'org-us-2' });
    expect(a).toBe(b);
    const c = router.getAssetStorageForOrg(euOrg);
    expect(c).not.toBe(a);
    const d = router.getAssetStorageForOrg(euOrg);
    expect(c).toBe(d);
  });
});

describe('createRegionRouter — getStorageBucketForOrg (AC #11)', () => {
  it('returns the EU bucket for EU orgs', () => {
    const usBucket = makeBucket('us');
    const euBucket = makeBucket('eu');
    const router = createRegionRouter({
      defaultFirestore: makeFirestore('default'),
      euFirestore: makeFirestore('eu-west'),
      defaultBucket: usBucket,
      euBucket,
    });
    expect(router.getStorageBucketForOrg(euOrg)).toBe(euBucket);
  });

  it('returns the US bucket for US orgs', () => {
    const usBucket = makeBucket('us');
    const euBucket = makeBucket('eu');
    const router = createRegionRouter({
      defaultFirestore: makeFirestore('default'),
      euFirestore: makeFirestore('eu-west'),
      defaultBucket: usBucket,
      euBucket,
    });
    expect(router.getStorageBucketForOrg(usOrg)).toBe(usBucket);
  });

  it('exposes default bucket-name constants (env-configurable downstream)', () => {
    expect(DEFAULT_US_BUCKET).toBe('stageflip-assets');
    expect(DEFAULT_EU_BUCKET).toBe('stageflip-eu-assets');
  });

  it('throws on unknown region for bucket routing too', () => {
    const router = createRegionRouter({
      defaultFirestore: makeFirestore('default'),
      euFirestore: makeFirestore('eu-west'),
      defaultBucket: makeBucket('us'),
      euBucket: makeBucket('eu'),
    });
    const bogus = { ...usOrg, region: 'apac' as unknown as 'us' };
    expect(() => router.getStorageBucketForOrg(bogus)).toThrow(/region/i);
  });

  it('throws if EU bucket missing when an EU org asks for it', () => {
    const router = createRegionRouter({
      defaultFirestore: makeFirestore('default'),
      euFirestore: makeFirestore('eu-west'),
      defaultBucket: makeBucket('us'),
    });
    expect(() => router.getStorageBucketForOrg(euOrg)).toThrow(/eu/i);
  });
});

describe('createRegionRouter — back-compat (AC #12, #13)', () => {
  it('routes orgs whose region defaulted to "us" via Zod to the default Firestore', () => {
    const defaultFs = makeFirestore('default');
    const router = createRegionRouter({
      defaultFirestore: defaultFs,
      euFirestore: makeFirestore('eu-west'),
    });
    // Simulate a record persisted before T-271 (no region field) that just
    // parsed through orgSchema with the .default('us') filling in.
    const legacyOrg: Org = { ...usOrg, region: 'us' };
    expect(router.getFirestoreForOrg(legacyOrg)).toBe(defaultFs);
  });
});
