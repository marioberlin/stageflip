// packages/storage/src/tenant-adapter-credentials-store.ts
// TenantAdapterCredentialsStore — per-tenant + per-adapter credential
// store (T-444). Sibling facet to `TenantSettingsStore` (T-411a) and
// `TenantCostTrackerStore` (T-443). The host's `SandboxFactory` calls
// `getCredentials(tenantId, adapterId)` and forwards ONLY the matched
// record to the runner — the adapter never sees credentials for OTHER
// adapters even within the same tenant.
//
// Validation at the write boundary: empty `{}` rejected, kebab-case
// adapterId enforced. The contract is the last gate; callers may have
// already parsed.

import {
  type AdapterCredential,
  adapterCredentialSchema,
  adapterIdSchema,
} from './tenant-adapter-credentials.js';

export type { AdapterCredential };

/**
 * Storage facet for per-tenant + per-adapter credentials. Concrete
 * adapters (in-memory, Postgres, Firebase) all implement this
 * contract; consumers pick the adapter at boot.
 */
export interface TenantAdapterCredentialsStore {
  /**
   * Read the credential for `(tenantId, adapterId)`. Returns `null`
   * when no row exists.
   */
  getCredentials(tenantId: string, adapterId: string): Promise<AdapterCredential | null>;

  /**
   * Upsert the credential for `(tenantId, adapterId)`. Implementations
   * validate the payload + the kebab-case adapterId before persisting.
   */
  setCredentials(tenantId: string, adapterId: string, credential: AdapterCredential): Promise<void>;

  /**
   * List the adapter ids for which `tenantId` has credentials
   * configured. Returns an empty array when no rows exist.
   */
  listAdapterIds(tenantId: string): Promise<readonly string[]>;

  /**
   * Remove the credential for `(tenantId, adapterId)`. No-op if no row
   * exists.
   */
  deleteCredentials(tenantId: string, adapterId: string): Promise<void>;
}

/**
 * In-memory `TenantAdapterCredentialsStore`. Rows live in a nested
 * Map: `tenantId → adapterId → credential`. `reset()` clears all
 * state.
 */
export class InMemoryTenantAdapterCredentialsStore implements TenantAdapterCredentialsStore {
  private rows = new Map<string, Map<string, AdapterCredential>>();

  async getCredentials(tenantId: string, adapterId: string): Promise<AdapterCredential | null> {
    return this.rows.get(tenantId)?.get(adapterId) ?? null;
  }

  async setCredentials(
    tenantId: string,
    adapterId: string,
    credential: AdapterCredential,
  ): Promise<void> {
    adapterIdSchema.parse(adapterId);
    const parsed = adapterCredentialSchema.parse(credential);
    let inner = this.rows.get(tenantId);
    if (inner === undefined) {
      inner = new Map();
      this.rows.set(tenantId, inner);
    }
    inner.set(adapterId, parsed);
  }

  async listAdapterIds(tenantId: string): Promise<readonly string[]> {
    const inner = this.rows.get(tenantId);
    return inner === undefined ? [] : Array.from(inner.keys());
  }

  async deleteCredentials(tenantId: string, adapterId: string): Promise<void> {
    const inner = this.rows.get(tenantId);
    if (inner === undefined) return;
    inner.delete(adapterId);
    if (inner.size === 0) {
      this.rows.delete(tenantId);
    }
  }

  /** Test-only hook to clear all state. */
  reset(): void {
    this.rows.clear();
  }

  /** Number of tenants with at least one configured credential. */
  size(): number {
    return this.rows.size;
  }
}
