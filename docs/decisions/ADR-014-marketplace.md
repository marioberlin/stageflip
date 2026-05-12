# ADR-014: Marketplace — Hosting + Distribution

**Date**: 2026-05-13
**Ratified**: pending (T-492 ratification PR; orchestrator approval)
**Status**: **Proposed**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

ADR-012 (T-490) decided the bundle format + signature scheme.
ADR-013 (T-491) decided the catalogue + pricing tiers. This ADR is
the **third and final Phase 16 α hard-gate ADR** — together with
ADR-012 + ADR-013 it closes the gate; T-493+ unblocks.

This ADR decides:

1. **Marketplace hosting** — dedicated registry vs. npm + scoped +
   auth (the plan's framing).
2. **Publisher-key distribution** — how trust is bootstrapped.
3. **Per-pack delivery** — protocol (HTTPS pull vs. push) + CDN.
4. **Tenant install workflow** — UX from marketplace → install →
   activated.

S-sized — narrower than ADR-012 + ADR-013. Focused on the
hosting decision + supporting wiring.

### What this ADR is **not**

- **Not the format ADR.** ADR-012 owns.
- **Not the catalogue / pricing ADR.** ADR-013 owns.
- **Not the per-pack ADR.** T-500..T-505 own.
- **Not the receipt / checkout ADR.** T-540+ owns billing.

---

## Decisions

### D1. Hosting = dedicated registry at `marketplace.stageflip.dev`

The marketplace lives at `https://marketplace.stageflip.dev/v1/`:

```
GET  /v1/packs                            // list packs (paged)
GET  /v1/packs/{publisher}/{id}           // pack metadata
GET  /v1/packs/{publisher}/{id}/{version} // specific version metadata
GET  /v1/packs/{publisher}/{id}/{version}/download
                                          // signed download URL
                                          // (redirects to CDN)
GET  /v1/publishers/{id}/keys             // publisher public key set
POST /v1/entitlements/check               // tenant entitlement check
                                          // (per tenant API token)
```

The pack archive (`.stageflip-pack` per ADR-012 §D1) is served from
a CDN (Cloud CDN over Cloud Storage); the registry hands out
short-TTL signed download URLs.

**Why a dedicated registry** (not npm + scoped):

| Concern | Dedicated registry | npm + scoped + auth |
|---|---|---|
| Per-pack entitlement | first-class | requires npm's enterprise tier + custom auth proxy |
| Pack-format integrity | enforced at upload + at install | npm doesn't sign content; trust = scope ownership |
| Per-tenant install pinning | first-class | tenant's package.json — leaks into source control |
| Signature scheme | Ed25519 per ADR-012 | npm's signature scheme is incompatible |
| OSS-path optionality | trivially supported | npm's free tier is generous but doesn't model entitlement |
| Cost | ~$200/mo at launch (Cloud Storage + CDN + Cloud Run for the API) | $0 hosting cost but $XX/mo enterprise-tier npm if private packs needed |
| Operational complexity | net-new service to operate | leverages existing npm infrastructure |

The dedicated-registry trade-off: ~$200/mo OPEX for full control over
the model. Acceptable at launch; the operational cost stays bounded.

**Why HTTPS** (not WebDAV / S3 / WebSocket-based push). HTTPS is the
universal-cache-able + universal-firewall-friendly protocol. The
CDN handles caching at the edge; reduces origin load.

**Why short-TTL signed URLs** for download. Prevents URL-sharing
beyond the tenant boundary; enforces auth at the registry layer
without bloating each CDN request.

### D2. Publisher-key distribution = TOFU + registry endpoint

Each publisher has an Ed25519 keypair (per ADR-012 §D3). Public
keys are distributed via:

1. **First-party publishers** (StageFlip Inc.): bundled with
   `@stageflip/pack-loader` at npm-publish time. The loader holds a
   pinned key set that updates with each `pack-loader` release.
2. **Third-party publishers**: registered at
   `marketplace.stageflip.dev/v1/publishers/{id}/keys`. On first
   install, the loader fetches the publisher's key set + caches it
   on disk + pins (TOFU — trust-on-first-use, then pinned).

**Why TOFU** (not centralized PKI). A full PKI (cert authority,
chain-of-trust, revocation lists) is operationally expensive for the
v1 marketplace scale. TOFU matches the SSH-host-key model: secure
enough for a curated marketplace; lower operational cost.

**Key revocation** (compromise scenario):
- Publisher reports compromise → marketplace marks the key
  `revoked: true` in the keys endpoint.
- Loader's periodic key-set refresh (24h) picks up the revocation.
- Packs signed by the revoked key fail signature check at next
  load + emit `LF-PACK-SIGNATURE-INVALID` per ADR-012 §D10.

### D3. Per-pack delivery = pull from CDN + on-disk cache

Tenants pull packs from the CDN via:

```bash
$ stageflip pack install news-pro@1.0.0
# Resolves to https://marketplace.stageflip.dev/v1/packs/stageflip/news-pro/1.0.0/download
# Redirects to https://cdn.stageflip.dev/packs/.../news-pro-1.0.0.stageflip-pack
# Downloads to ~/.stageflip/packs/stageflip/news-pro/1.0.0/
# Verifies signature + integrity per ADR-012 §D3
# Adds to tenant's `tenant-packs.json` pinned list
```

The CDN edge cache TTLs match the pack's `version` immutability —
once a `stageflip/news-pro/1.0.0.stageflip-pack` is published, its
URL is immutable. New versions get new URLs.

**Why pull** (not push). Push (marketplace → tenant) requires
tenants to expose ingress + complicates firewall posture. Pull is
simpler for the operator + matches the package-manager idiom.

**Why on-disk cache** (not cache-on-CDN-only). Loader needs the
pack contents available at boot WITHOUT a network roundtrip;
headless / Cloud Run deployments pre-stage at image build time.

### D4. Tenant install workflow

```
Tenant admin opens stageflip-slide editor
  → Marketplace tab → browse / search
  → Select pack → click "Install"
  → If Paid tier: redirected to checkout flow (Stripe Customer
    Portal; T-540+ specifies)
  → Tenant entitlement created at TenantEntitlementsStore (T-496)
  → CLI / app downloads pack to ~/.stageflip/packs/
  → Loader verifies + activates
  → Pack contents (presets, clips, fonts) appear in the editor
```

The marketplace UX (browse, search, ranking) is T-540+. This ADR
specifies the protocol; the UX layer is downstream.

**Enterprise tier**: skips the self-serve checkout; the
StageFlip account team provisions the entitlement directly via
`/v1/entitlements/admin/grant` (out-of-band of the tenant-facing
endpoint).

### D5. Auth model = tenant API tokens

The marketplace API uses bearer-token auth on every endpoint
(matching the existing `apps/api` MCP-session JWT posture).

- Tenant API tokens are issued at tenant onboarding (T-540+ wires
  the issuance flow).
- Token rotation: 90-day max; tenant admins can rotate via the
  marketplace UX.
- Tokens scope to the tenant + carry the tenant id; entitlement
  checks happen against the bearer's tenant id.

**Why bearer tokens** (not OAuth). OAuth would add a layer the v1
marketplace doesn't need (no third-party identity providers). The
StageFlip tenant id IS the identity primitive.

**Why 90-day max** rotation. Long enough to be operationally easy
(quarterly is a natural cadence); short enough that a compromised
token doesn't have long-term implications. Tenants can rotate more
frequently if their security posture demands.

### D6. Free tier doesn't need the marketplace

Free-tier content ships bundled with the platform per ADR-013 §D5.
A Free-only tenant never hits the marketplace API — the loader
walks `~/.stageflip/packs/` (which is empty for Free) + falls back
to the built-in catalogue.

**Why no Free-tier marketplace API**. Premature operational
complexity. If a Free tenant later wants to install a Paid pack,
the standard tenant-onboarding flow provisions a token.

### D7. Marketplace publish API (v1)

First-party publishers (StageFlip Inc.) use a publish API:

```
POST /v1/packs/{publisher}/{id}/publish
Authorization: Bearer <publisher-token>
Content-Type: multipart/form-data
  manifest: <manifest.json>
  archive: <pack.stageflip-pack>
```

The registry verifies the signature + manifest at upload time;
rejects malformed packs before they reach the catalogue. Successful
upload appends to the version list + invalidates CDN caches for
the pack's metadata endpoint.

**Why server-side verification** (vs. trust-the-publisher). The
registry is the catalogue's source of truth; consistency is enforced
once (at upload) so every downstream consumer can trust it.

Third-party publish requires the publisher to be registered
+ approved per the plugin-ratification flow (T-498). Out of v1
marketplace scope.

### D8. Operational posture

- **Hosting region**: us-central1 (Cloud Run primary); EU-west1 read
  replica for residency (T-474 / ADR-009 §D5 EU posture inherited).
- **CDN**: Cloud CDN over Cloud Storage; edge POPs match the
  existing video / display delivery posture.
- **Monitoring**: existing OTel pipeline (T-264) consumes the
  registry's structured logs + traces. Synthetic monitors check
  the install flow daily.
- **DR**: pack archives are immutable + content-addressed; the CDN
  acts as a distributed cache. Registry metadata is in
  Firestore; existing Firestore DR posture applies.

### D9. SLA target (v1)

- Pack download: p95 < 500ms region-local; < 2s cross-region.
- Entitlement check: p95 < 100ms (in-memory entitlement cache per
  ADR-012 §D6).
- API uptime: 99.5% for the v1 launch (best-effort; T-540+ ratchets
  to 99.9% for Paid + Enterprise tiers).

### D10. Out of scope (downstream)

| Item | Deferred to |
|---|---|
| Marketplace UX (browse, search, ranking, free-trial UX) | T-541+ |
| Per-pack analytics + sales reporting | T-540+ |
| Receipt / invoice / refund flow | T-540+ |
| Third-party publisher approval flow | T-498 |
| Cross-region replication of pack archives | Out of v1 |
| Pack-format v2 (future evolution) | Out of v1; ADR amendment |
| Per-region pricing surface | Out of v1; ADR-013 §D12 lists |

---

## Rejected alternatives

### A. npm + scoped + auth (the plan's framing)

**Rejected per §D1.** npm's signature scheme is incompatible with
Ed25519; per-tenant entitlement requires custom auth proxy on top;
pack version pinning leaks into source control. Dedicated registry
wins on every concern except hosting cost ($200/mo OPEX vs. $0).
The cost trade-off is justified by the operational simplicity +
custom-scheme support.

### B. Centralized PKI (vs. TOFU)

**Rejected per §D2.** A full PKI (CA, cert chain, CRL) is
operationally expensive at v1 marketplace scale. TOFU matches the
SSH-host-key model — secure enough for a curated catalogue; lower
operational cost.

### C. Push-based delivery (registry → tenant)

**Rejected per §D3.** Push requires tenants to expose ingress +
complicates firewall posture. Pull matches the package-manager
idiom + uses standard HTTPS infrastructure.

### D. OAuth-based tenant auth (vs. bearer tokens)

**Rejected per §D5.** OAuth adds a layer the v1 marketplace doesn't
need (no third-party identity providers). StageFlip tenant id IS
the identity primitive.

### E. Free-tier marketplace API (vs. bundled-only Free)

**Rejected per §D6.** Premature operational complexity. Free-tier
content ships bundled with the platform; the marketplace API is
needed only when paid content enters the picture.

### F. Client-side signature verification only (no server-side at
publish)

**Rejected per §D7.** Trust-the-publisher leaves the catalogue
exposed to malformed uploads + verification-bypass attempts.
Server-side at publish is the single-source-of-truth check.

---

## Consequences

### Positive

- **Operational footprint defined.** ~$200/mo OPEX is bounded +
  predictable.
- **Custom auth + entitlement model.** Full control over the per-
  tenant gate.
- **Standard install UX.** Pull-based + signed downloads match
  package-manager idioms.

### Negative

- **Net-new service to operate.** Registry + CDN + publisher
  keys + tenant-token issuance.
- **TOFU has compromise-window risk.** A compromised publisher key
  affects every tenant until the 24h key-set refresh picks up the
  revocation. Documented as known v1 limitation.
- **No third-party publishers at launch.** First-party-only at the
  marketplace v1; third-party flow lands via T-498 / T-540+.

---

## Downstream consumers

- **T-493** (concept SKILL) writes the bundle concept skill citing
  this ADR + ADR-012 + ADR-013.
- **T-494** (`@stageflip/pack-format`) consumes the URL conventions
  from §D1 + the publish-API shape from §D7.
- **T-495** (`@stageflip/pack-loader`) implements the install flow
  per §D3 + §D4 + the TOFU publisher-key cache per §D2.
- **T-496** (`TenantEntitlementsStore`) is the storage tier for
  §D5 tenant tokens + entitlement set.
- **T-498** plugin-ratification flow extended for third-party
  publisher approval (out of v1).
- **T-540+** marketplace UX + billing integration + analytics +
  third-party publisher onboarding.

---

## §13 (structural extension) statement

**NOT a structural extension** — pure docs ADR. No new degree of
freedom in document / binding / renderer. The marketplace API shape +
registry endpoints are operational infrastructure, not platform
contracts.

Render verification N/A.
