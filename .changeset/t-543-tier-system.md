---
'@stageflip/marketplace-tier': minor
---

T-543 — Tier-resolution library (`@stageflip/marketplace-tier`) per
ADR-013 §D3. Pure server-side library that knits together the
marketplace registry (T-536), Stripe writer (T-537), npm-path
loader (T-539), and tenant-inventory admin (T-542) into a per-tenant
tier model. Exports `resolveTenantTier` (computes effective tier —
`'free' | 'paid' | 'enterprise' | 'none'` — for a (tenant, pack)
pair), `tierGate` (admission gate returning `{ok, tier, reason?,
detail?}` with reasons `no-entitlement | lapsed | revoked | pending |
trial-expired | limit-exceeded`), `DEFAULT_TIER_LIMITS` (per-tier
install + capability budget keyed by all four `TenantTier` values
including `'none'`), and `DEFAULT_TIER_POLICY` (bundles limits with
documentation-only trial / lapsed grace-period knobs — 7 / 3 days).
`'trial'` resolves to `'paid'` for paid-per-tenant packs (sibling of
`'active'`); enterprise packs require `'active'` + `contractRef`.
Determinism perimeter: outside. New skill at
`skills/stageflip/concepts/marketplace-tier/SKILL.md`.
