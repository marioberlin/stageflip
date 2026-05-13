// packages/marketplace-tier/src/index.ts
// T-543 — Public surface of `@stageflip/marketplace-tier`. The
// package is a tier-resolution LIBRARY consumed by the marketplace
// registry (T-536), the Stripe writer (T-537), the npm-path loader
// (T-539), and the tenant-inventory admin route (T-542). It does
// not perform I/O; callers resolve their async lookups upstream and
// pass projected inputs into `resolveTenantTier` / `tierGate`.
//
// Determinism perimeter: outside (server-side).

export type {
  EntitlementStatusInput,
  PackLicenseInput,
  TenantTier,
  TenantTierInput,
} from './resolver/tier-resolver.js';
export { resolveTenantTier } from './resolver/tier-resolver.js';

export type { TierGateOpts, TierGateResult } from './gate/tier-gate.js';
export { tierGate } from './gate/tier-gate.js';

export type { TierLimits } from './limits/tier-limits.js';
export { DEFAULT_TIER_LIMITS } from './limits/tier-limits.js';

export type { TierPolicyConfig } from './policy/tier-policy.js';
export {
  DEFAULT_TIER_POLICY,
  LAPSED_GRACE_PERIOD_MS,
  TRIAL_GRACE_PERIOD_MS,
} from './policy/tier-policy.js';
