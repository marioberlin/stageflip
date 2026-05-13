// packages/marketplace-tier/src/limits/tier-limits.ts
// T-543 — Per-tier limits registry per ADR-013 §D3. `TierLimits`
// captures the install + capability budget for each tenant tier;
// `DEFAULT_TIER_LIMITS` is the production-default map keyed by
// `TenantTier`. Production deployments may override via
// `TierPolicyConfig.limits` (see `../policy/tier-policy.ts`).
//
// Determinism perimeter: outside (server-side).

import type { TenantTier } from '../resolver/tier-resolver.js';

/**
 * Install + capability budget for a single tenant tier. `null` means
 * unlimited; finite numbers are hard caps enforced by `TierGate` via
 * the `currentInstalledCount` input.
 *
 * Fields:
 * - `maxOpenPacks`: cap on open-licensed packs the tenant may install
 * - `maxPaidPacks`: cap on paid-per-tenant packs the tenant may install
 * - `maxEnterprisePacks`: cap on enterprise packs (typically unlimited
 *   for the `'enterprise'` tier, zero otherwise)
 * - `allowCustomBranding`: whether the tier may upload custom brand
 *   assets / themes
 * - `allowPrivatePacks`: whether the tier may publish or install
 *   private (non-marketplace) packs
 */
export interface TierLimits {
  readonly maxOpenPacks: number | null;
  readonly maxPaidPacks: number | null;
  readonly maxEnterprisePacks: number | null;
  readonly allowCustomBranding: boolean;
  readonly allowPrivatePacks: boolean;
}

/**
 * Production-default limits keyed by `TenantTier`. The `'none'` tier
 * (no resolved tier — e.g. paid pack with no entitlement) carries the
 * empty budget; gate calls against it always fail.
 *
 * Free tier caps open packs at 10 by default per ADR-013 §D3; paid +
 * enterprise tiers are unlimited within their pack-kind. Custom
 * branding + private packs are enterprise-only.
 */
export const DEFAULT_TIER_LIMITS: Record<TenantTier, TierLimits> = {
  none: {
    maxOpenPacks: 0,
    maxPaidPacks: 0,
    maxEnterprisePacks: 0,
    allowCustomBranding: false,
    allowPrivatePacks: false,
  },
  free: {
    maxOpenPacks: 10,
    maxPaidPacks: 0,
    maxEnterprisePacks: 0,
    allowCustomBranding: false,
    allowPrivatePacks: false,
  },
  paid: {
    maxOpenPacks: null,
    maxPaidPacks: null,
    maxEnterprisePacks: 0,
    allowCustomBranding: false,
    allowPrivatePacks: false,
  },
  enterprise: {
    maxOpenPacks: null,
    maxPaidPacks: null,
    maxEnterprisePacks: null,
    allowCustomBranding: true,
    allowPrivatePacks: true,
  },
};
