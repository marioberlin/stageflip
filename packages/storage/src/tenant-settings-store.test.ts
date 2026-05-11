// packages/storage/src/tenant-settings-store.test.ts
// Contract tests for InMemoryTenantSettingsStore (T-411a AC #9–15). The same
// surface is mirrored by the Postgres + Firebase adapter test files so
// 3-adapter parity is provable by name alignment.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTenantSettingsStore } from './tenant-settings-store.js';
import type { TenantSettings } from './tenant-settings.js';

const baseSettings = (over: Partial<TenantSettings> = {}): TenantSettings => ({
  tenantId: 'tenant-1',
  features: { interactive: 'disabled' },
  updatedAt: '2026-05-11T00:00:00.000Z',
  updatedBy: 'system',
  ...over,
});

describe('InMemoryTenantSettingsStore', () => {
  let store: InMemoryTenantSettingsStore;

  beforeEach(() => {
    store = new InMemoryTenantSettingsStore();
  });

  afterEach(() => {
    store.reset();
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
      expect(await store.getTenantSettings('tenant-1')).toEqual(s);
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

  describe('reset()', () => {
    it('clears all rows', async () => {
      await store.putTenantSettings(baseSettings({ tenantId: 'a' }));
      await store.putTenantSettings(baseSettings({ tenantId: 'b' }));
      expect(store.size()).toBe(2);
      store.reset();
      expect(store.size()).toBe(0);
      expect(await store.listTenantSettings()).toEqual([]);
    });
  });
});
