// packages/pack-loader/src/dependencies.ts
// T-495 — Forward-declared dependency interfaces the loader consumes.
// `TenantEntitlementsStore` lands concrete in T-496;
// `PublisherKeyRegistry` lands concrete in T-499. The loader holds
// only the structural interfaces here so it can be unit-tested
// against in-memory shims.

import type { LicenseClaim } from '@stageflip/pack-format';

/**
 * One tenant's entitlement record per ADR-013 §D4. Lifecycle:
 *   pending → active → lapsed → revoked
 * Stored by `TenantEntitlementsStore` (T-496); the loader treats it
 * read-only.
 */
export interface TenantEntitlement {
  readonly sku: string;
  readonly entitlementType: 'subscription' | 'one-time';
  readonly status: 'active' | 'lapsed' | 'revoked' | 'pending';
  readonly issuedAt: string; // ISO 8601
  readonly expiresAt?: string; // ISO 8601 (subscription)
  readonly contractRef?: string; // enterprise tier
}

/**
 * Per-tenant entitlement read surface. The concrete `TenantEntitlementsStore`
 * (T-496) implements this; tests pass an in-memory shim.
 */
export interface TenantEntitlementsLike {
  /**
   * Look up a single entitlement by sku for the calling tenant.
   * Returns `null` if no entitlement exists; returns the row
   * unchanged for active / lapsed / revoked alike (caller branches
   * on status).
   */
  getEntitlement(sku: string): Promise<TenantEntitlement | null>;
}

/**
 * Publisher public-key registry surface. The concrete registry
 * (T-499) implements TOFU bookkeeping (cache-on-first-install,
 * pinned thereafter); tests pass an in-memory shim.
 *
 * `getPublisherKey` returns the active public key for the publisher
 * id declared in the pack manifest. Returns `null` if the publisher
 * is unknown — the loader emits `LF-PACK-SIGNATURE-INVALID` in that
 * case (the signature check would fail anyway; the explicit `null`
 * surfaces the cause early).
 */
export interface PublisherKeyRegistryLike {
  getPublisherKey(publisherId: string): Promise<string | null>;
}

/**
 * Bundle of all loader dependencies. Passed to `loadPack` /
 * `discoverPacks`. Each loader call holds a snapshot of dependencies
 * so tests can swap them out per-call.
 */
export interface PackLoaderDependencies {
  readonly entitlements: TenantEntitlementsLike;
  readonly publisherKeys: PublisherKeyRegistryLike;
  /**
   * Current StageFlip platform version. Used for the §D7
   * `platformCompatibility` semver-range check. Tests inject any
   * value; production wiring imports from a `version.ts` constant.
   */
  readonly platformVersion: string;
}

/**
 * Determine whether a license claim requires entitlement verification
 * (paid-per-tenant + enterprise) vs. no-op gate (open).
 */
export function requiresEntitlement(license: LicenseClaim): boolean {
  return license.kind !== 'open';
}
