# ADR-013: First-party Pack Catalogue & Pricing Tiers

**Date**: 2026-05-13
**Ratified**: pending (T-491 ratification PR; orchestrator approval)
**Status**: **Proposed**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 16's marketplace-of-paid-content business model needs two
decisions before downstream work dispatches:

1. **What we sell at launch** — the inaugural six first-party packs
   the marketplace ships with on day 1. Naming, scope, target
   audience, contents.
2. **The pricing tier structure** — free / paid / enterprise.
   What's in each tier. How packs map to tiers. Per-tenant
   entitlement model from the tenant's perspective.

ADR-012 (T-490) decided the bundle format + license-claim primitives.
This ADR is the **second of three Phase 16 α hard-gate ADRs**;
together with ADR-014 (marketplace hosting) it closes the gate.

After this ADR + ADR-012 (merged) + ADR-014 (T-492) merge, T-493+
can dispatch.

### What this ADR is **not**

- **Not the bundle format ADR.** ADR-012 covers the file format +
  signature scheme + license-claim primitives.
- **Not the hosting ADR.** ADR-014 (T-492) decides registry vs.
  npm + scoped.
- **Not the per-pack ADR.** Each of the six launch packs has its own
  pack-spec doc (T-500..T-505); this ADR sets the catalogue + the
  pricing.
- **Not a billing-integration ADR.** Receipt / invoice / checkout
  flow is downstream operational work (T-540+).

---

## Decisions

### D1. Tier structure = three tiers

The marketplace exposes three tiers:

| Tier | Audience | Pack examples |
|---|---|---|
| **Free (OSS)** | Anyone using StageFlip; on by default | Bundled with the platform; Cluster A–I built-in presets |
| **Paid (per-tenant subscription)** | Indie creators + small studios | Six first-party launch packs per §D2; future third-party packs |
| **Enterprise** | Multi-tenant accounts; SLAs; custom packs | Custom-bundle production; private packs; revocable per-contract |

The runtime is **tier-agnostic**: it gates by `LicenseClaim` per
ADR-012 §D4. The tier is a marketplace-layer abstraction
(presentation + billing) that doesn't appear in the bundle manifest.

**Why three tiers** (not two). A pure free/paid split missed the
enterprise need (custom packs, audit trails, revocable per-contract).
Three is the minimum that covers the customer segments without
fragmenting the marketplace UX.

**Why not pay-per-clip** (a fourth tier). Per-clip billing
would push entitlement checks into every render frame (per ADR-012
§D6 rationale); per-pack subscription is the right granularity.

### D2. Six first-party launch packs

The marketplace ships with six inaugural first-party packs on day 1.
Each maps to a `paid-per-tenant` `LicenseClaim` per ADR-012 §D4.

| Pack id | Name | Scope | Contents |
|---|---|---|---|
| `news-pro` | News Pro | Broadcast news templates | Cluster A lower-thirds + tickers; Cluster D titles tuned for news; news-grade font pairings (Roboto + Roboto Slab; Inter + JetBrains Mono); 20 ratified presets + 6 parity goldens |
| `sports-networks` | Sports Networks | Sports broadcast templates | Cluster B scoreBugs + Cluster H AR overlays for soccer / football / basketball / swimming; Sky Sports + NBA + ESPN + TNT branded themes (NOT logos — generic broadcast-style); 16 ratified presets + 6 parity goldens |
| `creator-style` | Creator Style | Creator-economy CTAs + chat | Cluster G subscribe / follow / handle prompts; Cluster F captions tuned for YouTube + TikTok; influencer-aesthetic themes (gradient overlays + bold sans); 24 ratified presets + 6 parity goldens |
| `earnings-investor` | Earnings & Investor | Financial / quarterly-results | Cluster E bigNumber + fullScreen data visualizations; Cluster A breakingBanner for press-release headlines; finance-grade tabular numerics (Inter Tight + Inter Display); 18 ratified presets + 6 parity goldens |
| `wedding-events` | Wedding & Events | Lifecycle + life-event content | Cluster D titles (cinematic / wedding / event-card); Cluster F lyrics for ceremony slideshows; Cluster G social-handle for hashtag prompts; serif-heavy elegant theme; 22 ratified presets + 6 parity goldens |
| `frontier-effects` | Frontier Effects | Cluster I Live Audience + shader specials | Cluster I 6 audience presets (slido / mentimeter / kahoot / bbc-q-time / conference-qa / classroom-quiz); Cluster G shader-driven specials (T-470 ReactionStream variants); ~12 ratified presets + 11 parity goldens (Cluster I full set) |

**Total inaugural content**: 6 packs × ~20 presets avg = ~120 ratified
presets + 41 parity goldens. Each pack is independently purchasable.

**Pack contents are independent of paid-tier mechanics.** A future
third-party can ship a competing `news-pro` style pack; the
marketplace ranks them by signal (downloads, ratings) — out of v1
scope (T-540+).

### D3. Pricing model per tier

| Tier | Pricing | Renewal | Termination |
|---|---|---|---|
| **Free** | $0 | N/A | N/A |
| **Paid** | Per-pack subscription. Indicative launch pricing: ~$8-15/mo per pack OR ~$80-150/yr per pack. ADR documents the model; precise SKUs land at marketplace launch (T-540+). | Monthly auto-renew; per-pack opt-out | Tenant cancels per-pack; pack `liveMount` paths fall back to staticFallback per ADR-012 §D6 |
| **Enterprise** | Per-contract custom. Includes onboarding, custom packs, audit logs, SLA. | Contract term (typically annual) | Per-contract; reverts to Free tier on termination |

**Why subscription (not one-time)** for the Paid tier. Subscription
aligns ongoing updates (pack content evolves with the platform) with
ongoing revenue. One-time-purchase locked the tenant out of post-
purchase pack improvements. ADR-012 §D4 retains the
`entitlementType` field so a future one-time-purchase tier is
non-breaking.

**Why per-pack (not pack-bundle subscriptions)**. Tenants don't all
need all six packs. Per-pack subscriptions give the customer the
billing surface they want. The marketplace UX can recommend bundles
+ offer discounts; the SKU model stays per-pack.

### D4. Entitlement model from the tenant's perspective

A tenant holds a set of entitlements:

```typescript
interface TenantEntitlement {
  readonly sku: string;                    // matches LicenseClaim.sku
  readonly entitlementType: 'subscription' | 'one-time';
  readonly status: 'active' | 'lapsed' | 'revoked' | 'pending';
  readonly issuedAt: string;               // ISO 8601
  readonly expiresAt?: string;             // ISO 8601 (subscription)
  readonly contractRef?: string;           // enterprise tier
}
```

Stored in `TenantEntitlementsStore` (T-496 facet; mirrors
`TenantSettingsStore` T-411a pattern). Looked up by the runtime
gate at the two enforcement points per ADR-012 §D6.

**Status lifecycle**:
- `pending` → `active` (after first payment / contract sign)
- `active` → `lapsed` (subscription auto-renew failure or
  contract expiry without renewal)
- `active` → `revoked` (manual revocation; non-payment past grace
  period; T-540+ billing integration handles)

`lapsed` + `revoked` both fail the gate; the user-facing UX
distinguishes them (lapsed → "Renew your subscription"; revoked →
"Contact your admin").

### D5. Free pack catalogue

The Free tier ships:
- Every Cluster A–I built-in preset (the existing 56 from T-486 +
  P14/P13 work).
- Every built-in clip family (interactive + audience + frontier).
- All P14 reference adapters (Kokoro / Fish Speech / Tripo / Meshy
  / Seedance / Runway / ACE-Step / YuE / Stable Audio Open) in their
  stub-mode form.
- The native audience-backend adapter.

Free tenants get the full platform capability; only the **content
breadth** of paid packs is gated. This positioning is intentional:
the OSS-path optionality lives at the platform tier, not the
content tier.

### D6. Per-pack publication cadence

First-party packs ship on the StageFlip release cadence:
- **Launch** (Phase 16 close): all six packs go live simultaneously.
- **Quarterly updates**: each pack receives a content refresh per
  quarter (new presets / updated themes / parity fixture re-sign).
- **Major version**: aligned with StageFlip platform major
  (`platformCompatibility` per ADR-012 §D7).

Third-party packs ship at their author's cadence; ratification per
T-498 plugin-ratification flow.

### D7. Pack content review process

Pre-launch, every first-party pack receives:
1. **License audit** — every font + asset + preset cross-checked
   against the per-modality whitelist (per ADR-001 §D4 +
   ADR-008 §D13).
2. **Type-design review** — bespoke fonts pass the type-design
   consultant flow (ADR-004 §D4).
3. **Parity sign-off** — every preset's goldens PO-ratified via
   `manifest.auditTagged`.
4. **Security audit** — Ed25519 keypair generation + secure-storage
   audit (T-499).

Third-party packs receive a lighter ratification (T-498):
auto-license-check + signature verification + tenant-level trust
(TOFU on first install, pinned thereafter).

### D8. Pricing transparency + free-trial posture

- Each paid pack has a 14-day free trial (tenant can install + use
  without entitlement, with a watermark + nag-bar; downstream UX
  task).
- Pricing is published on the marketplace landing page (no
  enterprise-style "contact us" hiding for the Paid tier).
- Per-tenant invoicing transparency: tenants see active +
  lapsed-but-still-grace entitlements + their renewal dates.

### D9. Bundling discounts (out of v1 marketplace UX)

The marketplace MAY offer bundled discounts (e.g., "All 6 launch
packs for $50/mo, save $20"). Discount logic is marketplace-UX, not
license-claim. SKUs remain per-pack; discounts are applied at
checkout.

This is OUT of v1 marketplace scope; T-540+ may add.

### D10. Pack revocation + grace period

Subscription auto-renew failure starts a 7-day grace period during
which the entitlement remains `active` but the renewal-failure
notification surfaces in-editor. After day 7, status flips to
`lapsed`; the runtime gate denies new clip-instantiations + falls
back to staticFallback mid-session.

**Why 7 days**: long enough to update a payment method; short enough
that revocation isn't accidentally hidden.

Enterprise contracts have their own revocation flow per contract
terms.

### D11. Plugin-marketplace alignment

Per ADR-007 §D12 + ADR-012 §D11, packs participate in the existing
plugin-manifest contribution-kind system. The Pack Catalogue
extension carries:
- `tier: 'free' | 'paid' | 'enterprise'` — declared in the
  marketplace listing metadata (not in the manifest).
- `firstPartyPublisher: boolean` — distinguishes StageFlip-published
  from third-party.

Marketplace-layer concerns (ranking, search, recommendations) are
T-540+.

### D12. Out of scope (deferred to downstream specs)

| Item | Deferred to |
|---|---|
| Marketplace hosting + registry mechanics | ADR-014 (T-492) |
| Receipt + invoicing + checkout flow | T-540+ |
| Marketplace UX (ranking, search, recommendations) | T-541+ |
| Per-pack analytics + sales reporting | T-540+ |
| Refund policy | Out of v1 — marketplace launch decides |
| Per-region pricing (USD vs. EUR vs. GBP) | Out of v1; future hardening |
| Educational / non-profit discount tier | Out of v1; future hardening |

---

## Rejected alternatives

### A. Free + Paid only (no Enterprise tier)

**Rejected per §D1.** Two-tier missed the enterprise need (custom packs,
revocable per-contract, audit logs). Three tiers is the minimum.

### B. Pay-per-clip pricing

**Rejected per §D1 + ADR-012 §D6 rationale.** Per-clip billing pushes
entitlement checks into every render frame; per-pack subscription
matches the right granularity.

### C. One-time-purchase Paid tier (no subscription)

**Rejected per §D3.** Subscription aligns ongoing updates with ongoing
revenue. The `LicenseClaim.entitlementType` field retains optionality
for a future one-time tier.

### D. Pack-bundle subscriptions only (no per-pack)

**Rejected per §D3.** Tenants don't all need all six packs; per-pack
subscriptions match the customer's billing surface.

### E. Three free packs at launch (vs. all six paid)

**Rejected per §D5.** Free positioning at the platform tier, not the
content tier, is the OSS-path optionality posture. Every built-in
preset is free; paid packs add content breadth.

### F. Pre-launch ratification deferred to post-merge

**Rejected per §D7.** Launch packs need pre-launch ratification to
sustain the marketplace's "trusted-content" promise. Third-party
packs land later via lighter ratification per T-498.

---

## Consequences

### Positive

- **Launch revenue path clarified.** Six paid packs at launch;
  pricing-model decision unblocks marketplace UX work.
- **OSS-path optionality preserved.** Free tier includes the
  built-in catalogue; paid is purely additive content.
- **Enterprise contract surface defined.** Custom-pack production
  + per-contract revocation has a structural home.

### Negative

- **Pre-launch ratification cost.** Six packs × license + type-
  design + parity sign-off + security audit. Substantial pre-launch
  human time.
- **Marketplace UX is downstream work.** This ADR specifies the
  catalogue + pricing model but the customer-facing surface is
  T-540+.
- **Subscription billing integration overhead.** Receipt / invoice
  / refund / dunning flow is a substantial operational footprint
  not yet specified.

---

## Downstream consumers

- **T-492** (ADR-014 Marketplace) decides hosting / registry +
  publisher-key distribution. References §D5 (Free tier always
  on) + §D7 (review process).
- **T-494** (`@stageflip/pack-format`) consumes the `sku` from
  §D4 entitlements + the `LicenseClaim.sku` from ADR-012 §D4.
- **T-496** (`TenantEntitlementsStore`) ships the storage facet
  for the entitlement model per §D4.
- **T-497** runtime gate consults the entitlement store at the
  two enforcement points per ADR-012 §D6.
- **T-500..T-505** the six first-party launch packs per §D2:
  - T-500 News Pro
  - T-501 Sports Networks
  - T-502 Creator Style
  - T-503 Earnings & Investor
  - T-504 Wedding & Events
  - T-505 Frontier Effects (Cluster I full set + ReactionStream
    shader variants)
- **T-540+** marketplace UX (ranking, search, recommendations,
  pricing display, free-trial flow per §D8, revocation grace per
  §D10).

---

## §13 (structural extension) statement

**NOT a structural extension** — pure docs ADR. No new degree of
freedom in document / binding / renderer. The schema additions
(`TenantEntitlement`, pack catalogue metadata) land in T-496 +
T-500..T-505; those DO bear §13.

Render verification N/A.
