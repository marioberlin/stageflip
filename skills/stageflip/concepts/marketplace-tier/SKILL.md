---
title: Marketplace tier system
id: skills/stageflip/concepts/marketplace-tier
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-543
related:
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
  - skills/stageflip/concepts/marketplace-stripe/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Marketplace tier system

`@stageflip/marketplace-tier` is the per-tenant tier-resolution
library that knits together the marketplace components — registry
(T-536), Stripe writer (T-537), npm-path loader (T-539), tenant
inventory (T-542) — into a coherent tier model per ADR-013 §D3. It
is a pure library: callers resolve their async entitlement +
inventory lookups upstream and pass projected inputs into
`resolveTenantTier` / `tierGate`.

The package itself performs no I/O and depends on no other
StageFlip package; the `EntitlementStatusInput` + `PackLicenseInput`
shapes mirror `@stageflip/pack-loader` and `@stageflip/pack-format`
to keep the dep graph clean. Drift is caught by
`pnpm check-skill-drift` against this file plus the public exports.

Determinism perimeter: **outside** — server-side only. The package
is not imported by clip code or the frame runtime.

## The three tiers

Per ADR-013 §D3, each tenant occupies one of three tiers PER pack
(not globally — tier is resolved per (tenant, pack) pair):

| Tier | Trigger | Entitlement requirement |
|---|---|---|
| **Free** | Pack license is `open` | None |
| **Paid** | Pack license is `paid-per-tenant` | Entitlement status `'active'` or `'trial'` |
| **Enterprise** | Pack license is `enterprise` | Entitlement status `'active'` AND `contractRef` populated |

A failed resolution returns `'none'` — the gate fails closed.

`'trial'` is treated as a sibling of `'active'` for paid tier
resolution per `pack-loader/src/dependencies.ts` L13: install +
clip-mount gates admit the pack; the runtime separately emits
`LF-LICENSE-TRIAL-ACTIVE` so the host applies a watermark. For
enterprise packs `'trial'` does NOT count — enterprise requires a
signed `contractRef`.

## The four public surfaces

```ts
import {
  resolveTenantTier,
  tierGate,
  DEFAULT_TIER_LIMITS,
  DEFAULT_TIER_POLICY,
} from '@stageflip/marketplace-tier';
```

### 1. `resolveTenantTier(tenant, pack) → TenantTier`

Pure function. Inputs are a `TenantTierInput` (a `ReadonlyMap<sku,
{status, contractRef?, …}>`) and a `PackLicenseInput` (`{kind,
sku?}`). Returns `'free' | 'paid' | 'enterprise' | 'none'`. See the
truth-table in `src/resolver/tier-resolver.ts` for the full algorithm.

### 2. `tierGate(opts) → TierGateResult`

Admission gate. Composes `resolveTenantTier` with
`TierLimits.max<Kind>Packs` (looked up from `policy.limits[tier]`)
and the caller-supplied `currentInstalledCount`. Returns `{ok,
tier, reason?, detail?}`. Reasons are coarse-grained:
`no-entitlement` / `lapsed` / `revoked` / `pending` / `trial-expired`
/ `limit-exceeded`. The marketplace UI surfaces them; the install
path treats `!ok` as a hard refuse.

### 3. `DEFAULT_TIER_LIMITS: Record<TenantTier, TierLimits>`

Platform-default budget per tier. Keyed by ALL four `TenantTier`
values including `'none'` (zero budget across the board).

| Tier | maxOpen | maxPaid | maxEnterprise | branding | private |
|---|---|---|---|---|---|
| `none` | 0 | 0 | 0 | false | false |
| `free` | 10 | 0 | 0 | false | false |
| `paid` | ∞ | ∞ | 0 | false | false |
| `enterprise` | ∞ | ∞ | ∞ | true | true |

`null` = unlimited. Custom branding + private packs are
enterprise-only per ADR-013 §D3.

### 4. `DEFAULT_TIER_POLICY: TierPolicyConfig`

Bundles `limits` with the two grace-period knobs:

- `trialGracePeriodMs`: 604 800 000 (7 days)
- `lapsedGracePeriodMs`: 259 200 000 (3 days)

The grace fields are **documentation-only** at this layer. T-543 does
NOT consult time; the upstream caller (T-550 wiring) folds the grace
window into the `'active'` / `'lapsed'` decision before populating
`TenantTierInput.entitlements`. The fields live in the policy struct
so deployments can override the window without forking the policy
shape.

## Why pure?

ADR-012 + ADR-013 push the registry + Stripe + tier writer surfaces
into a layered pipeline. T-543 sits in the middle: between the
async entitlement reads (T-496 store) and the synchronous gate
decisions (UI + loader). Keeping it pure means:

- The same library powers both the install-time gate and the
  clip-mount gate without re-fetching entitlements.
- Tests are O(μs) — no fake clocks, no async harness.
- Downstream callers control the trial / lapsed grace policy by
  pre-resolving status at lookup time, so the gate sees a single
  authoritative status per entitlement.

## When the gate fails closed

```ts
const result = tierGate({
  pack: { kind: 'paid-per-tenant', sku: 'sku.news.pro' },
  tenant: { entitlements: new Map() }, // no entitlement
  policy: DEFAULT_TIER_POLICY,
});
// → { ok: false, tier: 'none', reason: 'no-entitlement', detail: … }
```

The UI surfaces `reason` directly; the install path logs `detail`
and refuses. See `marketplace-registry/SKILL.md` for how the gate
is wired into the install endpoint.
