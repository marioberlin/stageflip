// packages/storage/src/tenant-settings-store.ts
// TenantSettingsStore — contract interface + in-memory implementation per
// T-411 D-T411-1 / T-411a D-T411a-3 + D-T411a-4. A separate facet from
// `StorageAdapter` (doc-scoped) because tenant-scoped storage has a
// different key space and an independent lifecycle. Adapters that want to
// persist tenant settings implement this interface in addition to (or
// independently of) `StorageAdapter`.
//
// Default-deny semantics live one layer up (T-411b's tRPC `get` procedure
// materialises the default per T-411 D-T411-5). The store interface itself is
// pure: getters return what's persisted; an absent row returns `null`.

import { type TenantSettings, tenantSettingsSchema } from './tenant-settings.js';

/**
 * Storage facet for per-tenant settings. Concrete adapters
 * (in-memory, Postgres, Firebase) all implement this contract; consumers
 * pick the adapter at boot.
 */
export interface TenantSettingsStore {
  /**
   * Read a tenant's settings. Returns `null` when no row exists; callers
   * (notably T-411b's tRPC `tenantSettings.get`) materialise the
   * default-deny posture per T-411 D-T411-5.
   */
  getTenantSettings(tenantId: string): Promise<TenantSettings | null>;

  /**
   * Upsert a tenant's settings. Implementations validate the payload with
   * `tenantSettingsSchema.parse()` before persisting (defence in depth —
   * callers also validate, but the adapter is the last gate).
   */
  putTenantSettings(settings: TenantSettings): Promise<void>;

  /**
   * Superadmin-only: list every tenant's settings. Used by T-411b's
   * `tenantSettings.list` procedure for incident-response triage. Returns
   * an empty array when no rows exist.
   */
  listTenantSettings(): Promise<TenantSettings[]>;
}

/**
 * In-memory TenantSettingsStore. Single-process, not thread-safe in the
 * worker-thread sense; fine for tests and dev. Rows live in a Map keyed
 * on `tenantId`. `reset()` clears all rows.
 */
export class InMemoryTenantSettingsStore implements TenantSettingsStore {
  private rows = new Map<string, TenantSettings>();

  async getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
    return this.rows.get(tenantId) ?? null;
  }

  async putTenantSettings(settings: TenantSettings): Promise<void> {
    // Validate at the boundary even though callers should have already
    // parsed; the adapter is the last gate.
    const parsed = tenantSettingsSchema.parse(settings);
    this.rows.set(parsed.tenantId, parsed);
  }

  async listTenantSettings(): Promise<TenantSettings[]> {
    return Array.from(this.rows.values());
  }

  /** Test-only hook to clear all rows. */
  reset(): void {
    this.rows.clear();
  }

  /** Number of stored tenant rows. Exposed for tests. */
  size(): number {
    return this.rows.size;
  }
}
