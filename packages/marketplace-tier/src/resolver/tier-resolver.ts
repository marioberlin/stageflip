// packages/marketplace-tier/src/resolver/tier-resolver.ts
// T-543 — `TenantTierResolver` per ADR-013 §D3. Given a tenant's
// entitlements + a pack's license claim, returns the effective tier
// the tenant occupies for that pack ('free' / 'paid' / 'enterprise'
// / 'none'). The resolver is a pure function; status interpretation
// follows the §D4 lifecycle (pending / active / lapsed / revoked /
// trial sibling-of-active).
//
// Determinism perimeter: outside (server-side).

/**
 * Effective per-tenant tier for a single pack. Computed by
 * `resolveTenantTier`; consumed by `tierGate` + downstream UI.
 *
 * - `'free'`: open-licensed pack — no entitlement required
 * - `'paid'`: paid-per-tenant pack — entitlement is `'active'` or
 *   `'trial'` (sibling of active per pack-loader/dependencies.ts L13)
 * - `'enterprise'`: enterprise-licensed pack — entitlement is
 *   `'active'` and carries a `contractRef`
 * - `'none'`: tenant has no usable entitlement for the pack
 *   (missing / pending / lapsed / revoked / enterprise-without-
 *   contractRef)
 */
export type TenantTier = 'free' | 'paid' | 'enterprise' | 'none';

/** Mirrors `TenantEntitlement['status']` from `@stageflip/pack-loader`. */
export type EntitlementStatusInput = 'active' | 'lapsed' | 'revoked' | 'pending' | 'trial';

/**
 * Minimal entitlement projection the resolver needs. We accept a
 * `ReadonlyMap` keyed by sku rather than depending on the
 * pack-loader's `TenantEntitlementsLike` async interface — the
 * resolver itself is synchronous; the caller resolves the async
 * lookup upstream.
 */
export interface TenantTierInput {
  readonly entitlements: ReadonlyMap<
    string,
    {
      readonly sku: string;
      readonly status: EntitlementStatusInput;
      readonly entitlementType?: 'subscription' | 'one-time';
      readonly contractRef?: string;
    }
  >;
}

/**
 * Minimal license projection the resolver needs. Mirrors the
 * `LicenseClaim` discriminated union from `@stageflip/pack-format`
 * narrowed to the fields tier resolution consults. `sku` is required
 * for paid + enterprise kinds; `'open'` packs ignore it.
 */
export interface PackLicenseInput {
  readonly kind: 'open' | 'paid-per-tenant' | 'enterprise';
  readonly sku?: string;
}

/**
 * Compute the effective tier for `tenant` + `pack`.
 *
 * Algorithm (see ADR-013 §D3):
 *
 *   open pack                                        → 'free'
 *   paid pack + entitlement active                   → 'paid'
 *   paid pack + entitlement trial                    → 'paid'
 *   paid pack + entitlement lapsed/revoked/pending   → 'none'
 *   paid pack + no entitlement / no sku              → 'none'
 *   enterprise pack + active + contractRef           → 'enterprise'
 *   enterprise pack + active but missing contractRef → 'none'
 *   enterprise pack + lapsed/revoked/pending/trial   → 'none'
 *
 * Trial is treated as a sibling of active for tier purposes; the
 * runtime separately emits the `LF-LICENSE-TRIAL-ACTIVE` warning
 * (pack-loader §13). Lapsed grace is folded into the `'active'`
 * decision upstream by the caller — see `TierPolicyConfig`.
 */
export function resolveTenantTier(tenant: TenantTierInput, pack: PackLicenseInput): TenantTier {
  if (pack.kind === 'open') {
    return 'free';
  }

  if (pack.sku === undefined) {
    return 'none';
  }

  const entitlement = tenant.entitlements.get(pack.sku);
  if (entitlement === undefined) {
    return 'none';
  }

  if (pack.kind === 'paid-per-tenant') {
    if (entitlement.status === 'active' || entitlement.status === 'trial') {
      return 'paid';
    }
    return 'none';
  }

  // pack.kind === 'enterprise'
  if (entitlement.status !== 'active') {
    return 'none';
  }
  if (entitlement.contractRef === undefined || entitlement.contractRef.length === 0) {
    return 'none';
  }
  return 'enterprise';
}
