// packages/storage-firebase/src/tenant-settings.ts
// Firestore-backed `TenantSettingsStore` per T-411 D-T411-1 / T-411a D-T411a-6.
// Targets the `tenant_settings/{tenantId}` collection.
//
// The factory uses a structural `FirestoreTenantSettingsLike` interface
// (mirrors `BucketLike` / `FileLike` in `asset-storage.ts`) so unit tests can
// pass an in-memory shim — no Firebase emulator required for the structural
// happy paths. Per-region routing (US / EU) is the wiring layer's
// responsibility (T-411b); this factory accepts whichever Firestore the
// caller hands it.

import {
  type TenantSettings,
  type TenantSettingsStore,
  tenantSettingsSchema,
} from '@stageflip/storage';

const COLLECTION = 'tenant_settings';

/** Minimal Firestore document snapshot shape we read. */
export interface FirestoreDocSnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

/** Minimal Firestore document reference shape we use. */
export interface FirestoreDocRefLike {
  get(): Promise<FirestoreDocSnapshotLike>;
  set(data: Record<string, unknown>): Promise<unknown>;
}

/** Minimal Firestore query snapshot shape we read on `list`. */
export interface FirestoreQuerySnapshotLike {
  docs: Array<{ id: string; data(): Record<string, unknown> | undefined }>;
}

/** Minimal Firestore collection reference shape we use. */
export interface FirestoreCollectionRefLike {
  doc(id: string): FirestoreDocRefLike;
  get(): Promise<FirestoreQuerySnapshotLike>;
}

/**
 * Structural shape of `firebase-admin/firestore` Firestore the
 * tenant-settings store needs. Real `Firestore` from firebase-admin
 * satisfies this; tests pass an in-memory shim.
 */
export interface FirestoreTenantSettingsLike {
  collection(path: string): FirestoreCollectionRefLike;
}

/** Factory options for `createFirebaseTenantSettingsStore`. */
export interface FirebaseTenantSettingsStoreOptions {
  /** Firestore instance (use `regionRouter.getFirestoreForOrg(org)` per
   * region in production; pass an in-memory shim in tests). */
  firestore: FirestoreTenantSettingsLike;
}

/**
 * Build a TenantSettingsStore that persists to a Firestore
 * `tenant_settings/{tenantId}` collection. Per-region routing is the
 * wiring layer's responsibility (T-411b) — this factory accepts whichever
 * Firestore the caller hands it.
 */
export function createFirebaseTenantSettingsStore(
  opts: FirebaseTenantSettingsStoreOptions,
): TenantSettingsStore {
  const collection = opts.firestore.collection(COLLECTION);

  return {
    async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
      const snap = await collection.doc(tenantId).get();
      if (!snap.exists) return null;
      const data = snap.data();
      if (!data) return null;
      // Validate at the boundary: defence in depth against drift between
      // Firestore writes (which any privileged script can do) and the
      // Zod schema.
      return tenantSettingsSchema.parse({
        tenantId,
        features: data.features,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
    },

    async putTenantSettings(settings: TenantSettings): Promise<void> {
      const parsed = tenantSettingsSchema.parse(settings);
      // Firestore stores arbitrary JSON; we write the parsed payload minus
      // tenantId (the doc id is the tenantId).
      await collection.doc(parsed.tenantId).set({
        features: parsed.features,
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
      });
    },

    async listTenantSettings(): Promise<TenantSettings[]> {
      const snap = await collection.get();
      return snap.docs.map((doc) => {
        const data = doc.data() ?? {};
        return tenantSettingsSchema.parse({
          tenantId: doc.id,
          features: data.features,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        });
      });
    },
  };
}
