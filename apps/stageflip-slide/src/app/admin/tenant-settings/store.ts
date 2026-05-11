// apps/stageflip-slide/src/app/admin/tenant-settings/store.ts
// T-411e — module-level TenantSettingsStore instance for the admin UI.
//
// v1 ships a process-local InMemoryTenantSettingsStore (per spec
// §D-T411e-6). Production deployments swap the factory by replacing
// this module via a build-time alias or by injecting a per-request
// store via Next.js context — both are deployment-tier tasks.
//
// The store does NOT share state with `apps/api`'s store. Cross-app
// store sharing is a deployment concern explicitly out of scope.
//
// Tests override the store via `setStoreForTest(...)` so they don't
// depend on module-load ordering.

import { InMemoryTenantSettingsStore, type TenantSettingsStore } from '@stageflip/storage';

let storeInstance: TenantSettingsStore = new InMemoryTenantSettingsStore();

/** Read the current store instance (process-local default + test overrides). */
export function getStore(): TenantSettingsStore {
  return storeInstance;
}

/** Test-only: replace the store. Pass `undefined` to reset to a fresh in-memory store. */
export function setStoreForTest(next: TenantSettingsStore | undefined): void {
  storeInstance = next ?? new InMemoryTenantSettingsStore();
}
