// packages/storage-postgres/src/tenant-settings.test.ts
// Unit tests for `PostgresTenantSettingsStore` against pg-mem. Mirrors the
// in-memory adapter's `tenant-settings-store.test.ts` surface so 3-adapter
// parity is provable by name alignment (T-411a AC #18, #25).

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newDb } from 'pg-mem';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { TenantSettings } from '@stageflip/storage';

import type { AdapterPool } from './adapter.js';
import { type Migration, runMigrations } from './migration-runner.js';
import { PostgresTenantSettingsStore } from './tenant-settings.js';

const here = dirname(fileURLToPath(import.meta.url));
const INIT_SQL_PATH = join(here, 'migrations', '0001_init.sql');
const TENANT_SETTINGS_SQL_PATH = join(here, 'migrations', '0002_tenant_settings.sql');

interface PgMemAdapter {
  Pool: new () => unknown;
}

async function freshPool(): Promise<AdapterPool> {
  const db = newDb();
  const adapter = db.adapters.createPg() as PgMemAdapter;
  const pool = new adapter.Pool();
  const init: Migration = { name: '0001_init.sql', sql: await readFile(INIT_SQL_PATH, 'utf8') };
  const ts: Migration = {
    name: '0002_tenant_settings.sql',
    sql: await readFile(TENANT_SETTINGS_SQL_PATH, 'utf8'),
  };
  await runMigrations(pool as unknown as Parameters<typeof runMigrations>[0], [init, ts]);
  return pool as unknown as AdapterPool;
}

const baseSettings = (over: Partial<TenantSettings> = {}): TenantSettings => ({
  tenantId: 'tenant-1',
  features: { interactive: 'disabled' },
  updatedAt: '2026-05-11T00:00:00.000Z',
  updatedBy: 'system',
  ...over,
});

describe('PostgresTenantSettingsStore (pg-mem)', () => {
  let pool: AdapterPool;
  let store: PostgresTenantSettingsStore;

  beforeEach(async () => {
    pool = await freshPool();
    store = new PostgresTenantSettingsStore({ pool });
  });

  afterEach(async () => {
    const closer = (pool as { end?: () => Promise<void> }).end;
    if (closer) await closer.call(pool);
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

    it('returns every stored row, ordered by tenantId', async () => {
      await store.putTenantSettings(baseSettings({ tenantId: 'c' }));
      await store.putTenantSettings(baseSettings({ tenantId: 'a' }));
      await store.putTenantSettings(baseSettings({ tenantId: 'b' }));
      const rows = await store.listTenantSettings();
      expect(rows.map((r) => r.tenantId)).toEqual(['a', 'b', 'c']);
    });
  });
});
