// packages/storage-postgres/src/tenant-settings.ts
// `PostgresTenantSettingsStore` — implements the `TenantSettingsStore` facet
// from `@stageflip/storage` against the `tenant_settings` table introduced by
// migration 0002_tenant_settings.sql. See docs/tasks/T-411a.md D-T411a-5.
//
// Mirrors the structural-injection style of `PostgresStorageAdapter`:
// callers pass an `AdapterPool` (the same shape as pg.Pool / pg-mem); the
// store does not own pool lifecycle.

import {
  type TenantSettings,
  type TenantSettingsStore,
  tenantSettingsSchema,
} from '@stageflip/storage';

import type { AdapterPool } from './adapter.js';
import { mapPgError } from './errors.js';

/** Constructor options for `PostgresTenantSettingsStore`. */
export interface PostgresTenantSettingsStoreOptions {
  /** Pool used for tenant-settings reads/writes. Same shape as adapter.ts. */
  pool: AdapterPool;
}

/**
 * Postgres-backed TenantSettingsStore. Construct one per logical region
 * (us / eu) so per-region pools naturally honor tenant-data residency per
 * T-411 D-T411-1. No region-routing logic in this adapter — that lives at
 * the wiring layer (T-411b).
 */
export class PostgresTenantSettingsStore implements TenantSettingsStore {
  private readonly pool: AdapterPool;

  constructor(opts: PostgresTenantSettingsStoreOptions) {
    this.pool = opts.pool;
  }

  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    const client = await this.pool.connect();
    try {
      const res = await client.query<{
        tenant_id: string;
        features: unknown;
        updated_at: Date | string;
        updated_by: string;
      }>(
        'SELECT tenant_id, features, updated_at, updated_by FROM tenant_settings WHERE tenant_id = $1',
        [tenantId],
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      if (!row) return null;
      // Validate at the boundary: defence in depth against schema drift
      // between migration + Zod schema.
      return tenantSettingsSchema.parse({
        tenantId: row.tenant_id,
        features: row.features,
        updatedAt: toIso(row.updated_at),
        updatedBy: row.updated_by,
      });
    } catch (err) {
      throw mapPgError(err, { docId: tenantId, op: 'getTenantSettings' });
    } finally {
      client.release();
    }
  }

  async putTenantSettings(settings: TenantSettings): Promise<void> {
    const parsed = tenantSettingsSchema.parse(settings);
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO tenant_settings(tenant_id, features, updated_at, updated_by)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (tenant_id) DO UPDATE
           SET features    = EXCLUDED.features,
               updated_at  = EXCLUDED.updated_at,
               updated_by  = EXCLUDED.updated_by`,
        [parsed.tenantId, JSON.stringify(parsed.features), parsed.updatedAt, parsed.updatedBy],
      );
    } catch (err) {
      throw mapPgError(err, { docId: parsed.tenantId, op: 'putTenantSettings' });
    } finally {
      client.release();
    }
  }

  async listTenantSettings(): Promise<TenantSettings[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query<{
        tenant_id: string;
        features: unknown;
        updated_at: Date | string;
        updated_by: string;
      }>(
        'SELECT tenant_id, features, updated_at, updated_by FROM tenant_settings ORDER BY tenant_id ASC',
      );
      return res.rows.map((row) =>
        tenantSettingsSchema.parse({
          tenantId: row.tenant_id,
          features: row.features,
          updatedAt: toIso(row.updated_at),
          updatedBy: row.updated_by,
        }),
      );
    } catch (err) {
      throw mapPgError(err, { docId: '*', op: 'listTenantSettings' });
    } finally {
      client.release();
    }
  }
}

/** Coerce a PG TIMESTAMPTZ result (Date | string) to ISO 8601. */
function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  // pg-mem returns ISO strings already; preserve. Otherwise normalise via Date.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}
