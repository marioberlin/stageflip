// packages/storage-firebase/src/tenant-settings.test.ts
// Adapter unit tests against an in-memory `FirestoreTenantSettingsLike` shim.
// Mirrors the in-memory + Postgres tenant-settings test surfaces so 3-adapter
// parity is provable by name alignment (T-411a AC #25).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TenantSettings } from '@stageflip/storage';

import {
  type FirestoreCollectionRefLike,
  type FirestoreDocRefLike,
  type FirestoreTenantSettingsLike,
  createFirebaseTenantSettingsStore,
} from './tenant-settings.js';

/** In-memory Firestore shim covering the structural surface the adapter uses. */
function memoryFirestore(): FirestoreTenantSettingsLike {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();

  function getOrCreate(name: string): Map<string, Record<string, unknown>> {
    let map = collections.get(name);
    if (!map) {
      map = new Map();
      collections.set(name, map);
    }
    return map;
  }

  return {
    collection(name: string): FirestoreCollectionRefLike {
      const docs = getOrCreate(name);
      return {
        doc(id: string): FirestoreDocRefLike {
          return {
            async get() {
              const data = docs.get(id);
              return {
                exists: data !== undefined,
                data: () => (data === undefined ? undefined : { ...data }),
              };
            },
            async set(payload) {
              docs.set(id, { ...payload });
              return undefined;
            },
          };
        },
        async get() {
          return {
            docs: Array.from(docs.entries())
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([id, data]) => ({ id, data: () => ({ ...data }) })),
          };
        },
      };
    },
  };
}

const baseSettings = (over: Partial<TenantSettings> = {}): TenantSettings => ({
  tenantId: 'tenant-1',
  features: { interactive: 'disabled' },
  updatedAt: '2026-05-11T00:00:00.000Z',
  updatedBy: 'system',
  ...over,
});

describe('createFirebaseTenantSettingsStore', () => {
  let store: ReturnType<typeof createFirebaseTenantSettingsStore>;

  beforeEach(() => {
    store = createFirebaseTenantSettingsStore({ firestore: memoryFirestore() });
  });

  afterEach(() => {
    // No-op; per-test fresh shim.
  });

  describe('getTenantSettings', () => {
    it('returns null for an absent tenant', async () => {
      expect(await store.getTenantSettings('missing')).toBeNull();
    });
  });

  describe('putTenantSettings', () => {
    it('round-trips a stored payload', async () => {
      const s = baseSettings();
      await store.putTenantSettings(s);
      const got = await store.getTenantSettings('tenant-1');
      expect(got).not.toBeNull();
      expect(got?.tenantId).toBe('tenant-1');
      expect(got?.features.interactive).toBe('disabled');
      expect(got?.updatedBy).toBe('system');
    });

    it('upserts: a second put for the same tenant overwrites the first', async () => {
      await store.putTenantSettings(baseSettings({ features: { interactive: 'disabled' } }));
      await store.putTenantSettings(
        baseSettings({
          features: { interactive: 'preview' },
          updatedAt: '2026-05-11T00:01:00.000Z',
          updatedBy: 'admin@tenant',
        }),
      );
      const got = await store.getTenantSettings('tenant-1');
      expect(got?.features.interactive).toBe('preview');
      expect(got?.updatedBy).toBe('admin@tenant');
    });

    it('rejects an invalid payload (defence in depth)', async () => {
      await expect(
        store.putTenantSettings({
          ...baseSettings(),
          features: { interactive: 'experimental' as unknown as 'disabled' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('listTenantSettings', () => {
    it('returns [] when empty', async () => {
      expect(await store.listTenantSettings()).toEqual([]);
    });

    it('returns every stored row', async () => {
      await store.putTenantSettings(baseSettings({ tenantId: 'a' }));
      await store.putTenantSettings(baseSettings({ tenantId: 'b' }));
      await store.putTenantSettings(baseSettings({ tenantId: 'c' }));
      const rows = await store.listTenantSettings();
      expect(rows).toHaveLength(3);
      expect(new Set(rows.map((r) => r.tenantId))).toEqual(new Set(['a', 'b', 'c']));
    });
  });
});
