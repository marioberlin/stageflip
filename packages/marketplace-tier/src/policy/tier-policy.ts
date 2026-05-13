// packages/marketplace-tier/src/policy/tier-policy.ts
// T-543 — `TierPolicyConfig` declares the configurable knobs that
// govern tier resolution + gating. Production deployments may inject
// a custom policy (e.g. higher free-tier caps for partners, longer
// grace periods for enterprise); the `DEFAULT_TIER_POLICY` constant
// captures the platform defaults per ADR-013 §D3 + §D4.
//
// Determinism perimeter: outside (server-side).

import { DEFAULT_TIER_LIMITS, type TierLimits } from '../limits/tier-limits.js';
import type { TenantTier } from '../resolver/tier-resolver.js';

/**
 * Configurable policy knobs the tier-gate consults at decision time.
 *
 * - `limits`: per-tier install + capability budget; see
 *   `DEFAULT_TIER_LIMITS` for the platform default
 * - `trialGracePeriodMs`: how long after `'trial'` status expires the
 *   gate still admits the pack (default 7 days). Trials past this
 *   window resolve to `none` and fail the gate with
 *   `'trial-expired'`. Note: T-543 does NOT itself consult
 *   `expiresAt`; the field is documented here so downstream callers
 *   (T-550 wiring) can pass the resolved-at-time-of-check status into
 *   `TenantTierInput.entitlements`.
 * - `lapsedGracePeriodMs`: parallel knob for `'lapsed'` entitlements
 *   (default 3 days). Same documentation-only contract as
 *   `trialGracePeriodMs` — the upstream caller folds the grace window
 *   into the `'active'` / `'lapsed'` decision.
 */
export interface TierPolicyConfig {
  readonly limits: Record<TenantTier, TierLimits>;
  readonly trialGracePeriodMs: number;
  readonly lapsedGracePeriodMs: number;
}

/** Seven days in ms — default trial grace window per ADR-013 §D4. */
export const TRIAL_GRACE_PERIOD_MS = 604_800_000;

/** Three days in ms — default lapsed grace window per ADR-013 §D4. */
export const LAPSED_GRACE_PERIOD_MS = 259_200_000;

/**
 * Platform-default policy. Deployments inject a custom config via the
 * `TierGate` opts; tests use this constant directly.
 */
export const DEFAULT_TIER_POLICY: TierPolicyConfig = {
  limits: DEFAULT_TIER_LIMITS,
  trialGracePeriodMs: TRIAL_GRACE_PERIOD_MS,
  lapsedGracePeriodMs: LAPSED_GRACE_PERIOD_MS,
};
