// packages/marketplace-tier/src/gate/tier-gate.ts
// T-543 — `tierGate` is the install/use admission gate per ADR-013
// §D3. It composes `resolveTenantTier` with the tier-limits registry
// to produce a (ok, tier, reason?) result the marketplace UI + the
// pack-loader install path consume.
//
// Determinism perimeter: outside (server-side).

import type { TierLimits } from '../limits/tier-limits.js';
import type { TierPolicyConfig } from '../policy/tier-policy.js';
import {
  type PackLicenseInput,
  type TenantTier,
  type TenantTierInput,
  resolveTenantTier,
} from '../resolver/tier-resolver.js';

/**
 * Outcome of a single gate decision.
 *
 * - `ok`: gate admits the pack
 * - `tier`: the resolved tier; `'none'` for failures + free/paid/
 *   enterprise for admits
 * - `reason`: present iff `!ok`; coarse-grained classification the
 *   UI surfaces to the user
 * - `detail`: optional human-readable elaboration (e.g. which
 *   entitlement status was observed)
 */
export interface TierGateResult {
  readonly ok: boolean;
  readonly tier: TenantTier;
  readonly reason?:
    | 'no-entitlement'
    | 'lapsed'
    | 'revoked'
    | 'pending'
    | 'trial-expired'
    | 'limit-exceeded';
  readonly detail?: string;
}

/** Inputs to a single `tierGate` invocation. */
export interface TierGateOpts {
  readonly pack: PackLicenseInput;
  readonly tenant: TenantTierInput;
  readonly policy: TierPolicyConfig;
  /**
   * How many packs of the gated kind the tenant currently has
   * installed. The gate compares this against the tier's
   * `max<Kind>Packs` budget; passing `0` (or omitting) skips the
   * limit check for callers that haven't materialized the count.
   * Passing the count is the standard install-time pattern.
   */
  readonly currentInstalledCount?: number;
}

/**
 * Decide whether `tenant` may install or use `pack` under `policy`.
 *
 * Algorithm:
 *   1. Resolve effective tier via `resolveTenantTier`
 *   2. If tier is `'none'`, classify the failure reason from the
 *      observed entitlement state (`no-entitlement` / `pending` /
 *      `lapsed` / `revoked` / `trial-expired`).
 *   3. Otherwise look up the tier's `TierLimits` from the policy and
 *      enforce the install cap for the pack's kind.
 *
 * The gate does not consult time directly; trial / lapsed grace
 * windows are applied upstream by the caller before populating
 * `tenant.entitlements` (see `TierPolicyConfig` doc).
 */
export function tierGate(opts: TierGateOpts): TierGateResult {
  const tier = resolveTenantTier(opts.tenant, opts.pack);

  if (tier === 'none') {
    return buildNoneResult(opts);
  }

  const limits: TierLimits | undefined = opts.policy.limits[tier];
  if (limits === undefined) {
    return {
      ok: false,
      tier,
      reason: 'limit-exceeded',
      detail: `policy has no limits entry for tier '${tier}'`,
    };
  }

  const budget = budgetFor(opts.pack.kind, limits);
  const installed = opts.currentInstalledCount ?? 0;
  if (budget !== null && installed >= budget) {
    return {
      ok: false,
      tier,
      reason: 'limit-exceeded',
      detail: `tier '${tier}' caps ${opts.pack.kind} installs at ${budget}; tenant has ${installed}`,
    };
  }

  return { ok: true, tier };
}

function budgetFor(kind: PackLicenseInput['kind'], limits: TierLimits): number | null {
  switch (kind) {
    case 'open':
      return limits.maxOpenPacks;
    case 'paid-per-tenant':
      return limits.maxPaidPacks;
    case 'enterprise':
      return limits.maxEnterprisePacks;
  }
}

function buildNoneResult(opts: TierGateOpts): TierGateResult {
  // Open packs never resolve to 'none' — defensive only.
  if (opts.pack.kind === 'open') {
    return {
      ok: false,
      tier: 'none',
      reason: 'limit-exceeded',
      detail: 'open pack resolved to none — unexpected',
    };
  }

  if (opts.pack.sku === undefined) {
    return {
      ok: false,
      tier: 'none',
      reason: 'no-entitlement',
      detail: `pack of kind '${opts.pack.kind}' is missing required sku`,
    };
  }

  const entitlement = opts.tenant.entitlements.get(opts.pack.sku);
  if (entitlement === undefined) {
    return {
      ok: false,
      tier: 'none',
      reason: 'no-entitlement',
      detail: `tenant has no entitlement for sku '${opts.pack.sku}'`,
    };
  }

  switch (entitlement.status) {
    case 'lapsed':
      return {
        ok: false,
        tier: 'none',
        reason: 'lapsed',
        detail: `entitlement '${opts.pack.sku}' is lapsed`,
      };
    case 'revoked':
      return {
        ok: false,
        tier: 'none',
        reason: 'revoked',
        detail: `entitlement '${opts.pack.sku}' is revoked`,
      };
    case 'pending':
      return {
        ok: false,
        tier: 'none',
        reason: 'pending',
        detail: `entitlement '${opts.pack.sku}' is pending`,
      };
    case 'trial':
      // Reaches here only if pack kind === 'enterprise' (trial
      // resolves to 'paid' for paid-per-tenant). Treat as
      // trial-expired since enterprise tier requires `active` +
      // contractRef.
      return {
        ok: false,
        tier: 'none',
        reason: 'trial-expired',
        detail: `entitlement '${opts.pack.sku}' is trial but pack is enterprise`,
      };
    case 'active':
      // Reaches here only for enterprise without contractRef.
      return {
        ok: false,
        tier: 'none',
        reason: 'no-entitlement',
        detail: `enterprise entitlement '${opts.pack.sku}' lacks contractRef`,
      };
  }
}
