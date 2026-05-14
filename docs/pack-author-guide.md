<!-- docs/pack-author-guide.md — Third-party pack-author guide for the StageFlip marketplace (T-551). -->

# StageFlip Pack-Author Guide

End-to-end reference for third parties publishing a content pack to the
StageFlip marketplace. The full Phase 16 δ stack is in place — registry
(T-536), Stripe writer (T-537), npm-path verifier (T-539), upgrade
planner (T-540), telemetry dashboard (T-541), tier system (T-543),
conversion flows (T-544), refund + dispute handling (T-545), parity
validator (T-549), GA-readiness audit (T-550). This document is the
single reading-order entry-point for an external publisher.

If you are extending the workspace itself (first-party pack inside this
monorepo), read `CLAUDE.md` first and treat this guide as advisory.

---

## 1. Overview

A **pack** is a deterministic, signed bundle of content that a tenant
opts into post-install. A pack contributes any combination of:

- **Presets** — declarative markdown bodies the engine compiles into
  RIR at clip-mount time. Most packs ship presets only.
- **Concept skills** — `SKILL.md` files extending the in-context skill
  tree (`skills/stageflip/concepts/pack-<id>/SKILL.md`); see CLAUDE.md
  §5 ("Installed packs extend the skill tree").
- **Optional clipKind primitives** — new clip implementations (rare;
  most clip kinds live in the engine).
- **Optional parity fixtures** — required when the pack introduces a
  new render surface (see §5).
- **Optional fonts, assets, tools, adapters, themePacks** — declared
  via `contributes` in the manifest.

There are two distribution paths per [ADR-014](decisions/ADR-014-marketplace.md):

| Path | Hosted by | Tenant install via | Use when |
|---|---|---|---|
| **Registry (path A)** | StageFlip-operated marketplace | `POST /api/v1/packs/...` upload + signed-URL download | Default for paid + open packs. |
| **npm-path (path B)** | Publisher-controlled npm scope | `npm install @scope/pack-<id>` + tenant-scoped npm token | When the publisher wants full control over distribution / billing. |

**Pack-id namespace convention:** `pack-<publisher>-<id>`
(e.g. `pack-acmecorp-finance-charts`). The package name is
`@<scope>/pack-<id>` for npm-path packs. The manifest `id` field is
lowercase kebab-case per `packManifestSchema` and must match the npm
package basename for path B.

---

## 2. Prerequisites

- **Node 22** (`engines.node` is enforced by the workspace; publisher
  packages SHOULD match).
- **pnpm 10** (we lock to pnpm; npm/yarn untested).
- **`@stageflip/pack-publish-cli`** — installs the
  `stageflip-pack-publish` binary (validate / sign / publish / license
  subcommands).
- **`@stageflip/pack-signing`** — installs the `stageflip-pack-sign`
  binary (Ed25519 keypair generation + sign + verify; T-498).

Install:

```bash
pnpm add -D @stageflip/pack-publish-cli @stageflip/pack-signing
```

Generate your publisher Ed25519 keypair (one-time, retain the private
key in a secret manager):

```bash
stageflip-pack-sign generate-keys --out-dir ./keys
# writes ./keys/publisher.private.pem + ./keys/publisher.public.pem
```

The first publish binds your public key to your `publisher.id` via
**TOFU** (trust-on-first-use) at the registry per
`packages/marketplace-registry/src/publishers/registry.ts`. Subsequent
publishes from the same publisher MUST present the same public key or
the registry rejects with `403 forbidden / publisher-key-mismatch`.

---

## 3. Pack manifest schema

The strict Zod schema is `packManifestSchema` exported from
[`@stageflip/pack-format`](../packages/pack-format/src/manifest.ts) per
[ADR-012](decisions/ADR-012-bundle-format-license-runtime.md) §D2.
Unknown keys reject at parse time. The first-party launch packs each
ship a typed `MANIFEST_SKELETON` (see
`packages/pack-news-pro/src/manifest.ts` for the canonical example).

Archive shape: **SFPACK1** — an 8-byte magic (`SFPACK1\n`) followed by
a deterministic concatenation of (path-length, path, content-length,
content) blocks sorted lexicographically by relative path
(`packages/pack-signing/src/archive.ts`, T-498). The archive's
`integrity.hash` is a SHA-256 over the synthesized archive bytes;
its computation **excludes** the manifest's `integrity` entry itself
per ADR-012 §D3 + T-498 (the manifest is built with a placeholder hash
of 64 zeroes, archived, hashed, then the placeholder is replaced).

Minimal `manifest.json`:

```json
{
  "manifestVersion": "1",
  "id": "finance-charts",
  "name": "Finance Charts",
  "version": "1.0.0",
  "publisher": {
    "id": "acmecorp",
    "displayName": "Acme Corp"
  },
  "platformCompatibility": "^2.0.0",
  "license": {
    "kind": "paid-per-tenant",
    "sku": "acmecorp-finance-charts-1y",
    "entitlementType": "subscription"
  },
  "integrity": {
    "algorithm": "sha256",
    "hash": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "contributes": {
    "presets": [
      { "id": "candlestick-classic", "cluster": "cluster-finance" }
    ]
  }
}
```

Fields:
- `manifestVersion`: literal `"1"` for the current format.
- `id`: lowercase kebab-case; `^[a-z0-9][a-z0-9-]*[a-z0-9]$`.
- `version`: SemVer 2.0.
- `platformCompatibility`: SemVer range against the host engine.
- `license.kind`: `"open"` | `"paid-per-tenant"` | `"enterprise"`
  (`licenseClaimSchema`, ADR-012 §D4).
- `contributes`: union of `presets` / `clipKinds` / `fonts` /
  `fixtures` / `assets` / `tools` / `adapters` / `themePacks`
  (`packContributionsSchema`).
- Optional: `description` / `homepage` / `repository` / `keywords` /
  `dependsOn` / `requiresAdapter`.

---

## 4. Authoring presets and concept skills

### 4.1 Directory layout

```
my-pack/
├── manifest.json                      # produced by your build script
├── LICENSE.md
├── NOTICE.md
├── packs/
│   └── presets/
│       ├── candlestick-classic.md
│       └── line-chart-clean.md
└── skills/
    └── concepts/
        └── pack-acmecorp-finance-charts/
            └── SKILL.md
```

### 4.2 Concept skill contract

Every pack contributes one concept skill at
`skills/stageflip/concepts/pack-<id>/SKILL.md` (CLAUDE.md §5, T-547).
All six first-party launch packs follow this contract — see
`skills/stageflip/concepts/pack-news-pro/SKILL.md` as reference.

Minimal `SKILL.md` frontmatter:

```yaml
---
title: Finance Charts Pack
id: skills/stageflip/concepts/pack-acmecorp-finance-charts
tier: concept
status: substantive
last_updated: 2026-05-14
owner_task: T-XXX
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
  - skills/stageflip/concepts/presets/SKILL.md
---

# Finance Charts Pack

<one-paragraph summary of what the pack contributes, license tier, SKU>
```

The skill body documents what the pack contributes, intended cluster
fit, and any divergences from base-cluster defaults. The pack's
shipped presets each get a preset-id-level skill entry per CLAUDE.md
§5 (T-547).

### 4.3 Skill drift

`pnpm check-skill-drift` is **core-only** (covers `skills/stageflip/**`
inside the workspace). Per-pack skill drift is the publisher's
responsibility. T-548 extended the gate to surface per-pack skill
drift as **warnings** (never fail-build); the tier-coverage invariant
remains core-only.

---

## 5. Parity fixtures

Packs that introduce a **new render surface** — e.g. Cluster D
(typography-heavy), Cluster G (Frontier-effects-style), or any
custom-cluster — MUST ship parity fixtures and validate them via
[`@stageflip/pack-parity-validator`](../packages/pack-parity-validator/src/index.ts)
(T-549). Packs that contribute presets only against existing
engine clip kinds MAY skip parity fixtures (the engine's existing
fixtures cover the render path).

### 5.1 Cluster → threshold mapping

`DEFAULT_CLUSTER_THRESHOLDS` in
`packages/pack-parity-validator/src/thresholds/cluster-thresholds.ts`:

| Cluster id | min PSNR (dB) | min SSIM |
|---|---|---|
| `cluster-a` | 35 | 0.95 |
| `cluster-b` | 35 | 0.95 |
| `cluster-c` | 32 | 0.92 |
| `cluster-d` | 36 | 0.96 |
| `cluster-e` | 35 | 0.95 |
| `cluster-f` | 35 | 0.95 |
| `cluster-g` | 35 | 0.95 |
| `cluster-h` | 33 | 0.93 |
| `cluster-i` | 32 | 0.92 |
| `default`   | 35 | 0.95 |

Unknown cluster ids fall back to the `default` row via
`resolveClusterThreshold`.

### 5.2 Validation

Call `validatePackFixtures` from
`@stageflip/pack-parity-validator` against your contributed fixtures.
The validator scores every fixture against the cluster's PSNR + SSIM
gates; the install-time pack-loader gate (T-495) and the future
publish-time registry gate consult the same module.

Parity-fixture sign-off lives in preset frontmatter only. **Do not**
write to `docs/ops/parity-fixture-signoff.md` — that doc is
procedural and managed in-workspace.

---

## 6. Building and signing

### 6.1 Validate (pre-flight)

```bash
stageflip-pack-publish validate ./my-pack
```

Runs the T-499 pack-integrity invariants against the unsigned source
directory. Exits 0 if no fail rows, 1 otherwise.

### 6.2 Sign

```bash
stageflip-pack-sign sign ./my-pack \
  --key ./keys/publisher.private.pem \
  --out ./dist/my-pack.sfpack
```

The `sign` subcommand:
1. Walks `./my-pack` and synthesizes a deterministic SFPACK1 archive.
2. Computes SHA-256 over the archive bytes (the `integrity.hash`
   domain — manifest's own integrity entry uses placeholder zeroes
   during hashing per ADR-012 §D3 + T-498).
3. Patches `manifest.json`'s `integrity.hash` to the computed value
   and re-archives.
4. Signs with Ed25519 and writes the signature alongside (`*.sig`,
   raw 64-byte signature; `ED25519_SIGNATURE_LENGTH` constant from
   `@stageflip/pack-format`).

The `@stageflip/pack-publish-cli`'s `sign` subcommand wraps the same
flow with a pre-flight validate. Either CLI is acceptable.

### 6.3 Verify locally

```bash
stageflip-pack-sign verify ./dist/my-pack.sfpack \
  --key ./keys/publisher.public.pem
```

Round-trips the signature against the public key. The marketplace
registry runs the same verify on publish (`verifyPackArchive` from
`@stageflip/pack-format/signature`).

### 6.4 Publisher-key TOFU registration

First publish for a `publisher.id` registers (binds) the public key.
Every subsequent publish from that publisher MUST present the same
public key or the registry rejects with `publisher-key-mismatch`. Key
rotation requires a registry-side admin operation; plan accordingly.

---

## 7. Distribution path A — Registry

The registry is `@stageflip/marketplace-registry` (T-536). The
publisher uploads via:

```
POST /api/v1/packs
Authorization: Bearer <publisher-token>
Content-Type: application/json

{
  "packId": "<manifest.id>",
  "version": "<manifest.version>",
  "manifest": { ...manifest.json... },
  "archiveBase64": "<base64 archive bytes>",
  "signatureBase64": "<base64 detached signature>",
  "publisherPublicKeyPem": "<PEM-encoded Ed25519 public key>"
}
```

Status codes (`packages/marketplace-registry/src/routes/publish.ts`):

| Code | Body `error` | Meaning |
|---|---|---|
| `201` | — | Persisted. Returns `{ publisherId, packId, version, manifestKey, archiveKey, signatureKey }`. |
| `400` | `bad-request` | malformed JSON / manifest / base64 / `signature-length` / `signature-invalid`. |
| `401` | `unauthorized` | `missing-bearer` / `invalid-token`. |
| `403` | `forbidden` | `publisher-mismatch` (manifest's publisher.id ≠ token's bound publisher) / `publisher-key-mismatch`. |
| `409` | `conflict` | `version-already-published` (versions are immutable per ADR-014 §D3). |
| `500` | `internal` | handler exception. |

### 7.1 Per-publisher token bootstrap

Bearer tokens are issued out-of-band by the marketplace operator and
bound to a single `publisherId`. The token's bound publisher MUST
match the `publisher.id` in every manifest you publish or the
registry rejects with 403.

### 7.2 Manifest GET endpoints

The registry exposes per-pack list + signed-URL download routes under
the same `/api/v1/packs/...` prefix; see
`packages/marketplace-registry/src/routes/list.ts` and `download.ts`.
Signed URLs expire after `SIGNED_URL_TTL_SECONDS`.

### 7.3 publish CLI

`stageflip-pack-publish publish` automates the upload:

```bash
stageflip-pack-publish publish ./dist/my-pack.sfpack \
  --registry https://marketplace.stageflip.dev \
  --token MY_PUBLISHER_TOKEN \
  --publisher-key ./keys/publisher.public.pem
```

`--token` names an environment variable holding the bearer; the CLI
never accepts the secret on the command line. Use
`--registry dry-run://anything` to print the intent without an HTTP
call.

---

## 8. Distribution path B — npm-path

`@stageflip/marketplace-npm` (T-539, ADR-014 §D2 + §D4) implements the
npm-based fallback. The publisher publishes the SFPACK1 archive as a
standard npm package under their scope; the tenant installs via
`npm install`. License-claim verification runs locally on the host
via `verifyLicenseClaim`
(`packages/marketplace-npm/src/verifier/license-verifier.ts`):

| `license.kind` | Token check | Entitlement check | LF on miss |
|---|---|---|---|
| `open` | none | none | — (always passes) |
| `paid-per-tenant` | required for publisher scope | must be `active` | `LF-NPM-TOKEN-MISSING` (no token) / `LF-LICENSE-PACK-DENIED` (no / lapsed / pending) / `LF-LICENSE-CLIP-REVOKED` (revoked) |
| `enterprise` | required for publisher scope | must be `active` | same as above |

`LF-NPM-TOKEN-MISSING` (severity `error`) is emitted when the host
cannot find a tenant-scoped npm auth token for the publisher's scope
of a paid / enterprise pack. The publisher MUST ship a token-issuing
flow to tenants (typically via the publisher's own dashboard).

### 8.1 Sidecar /verify endpoint

`createSidecarClient` (`packages/marketplace-npm/src/sidecar/`) is
the HTTP client for an entitlement-verification sidecar the publisher
operates. The sidecar takes a `SidecarVerifyInput` (license claim +
publisher scope + tenant context) and returns a `SidecarVerifyResult`
that the local verifier consumes. The sidecar contract is decoupled
from the registry — npm-path publishers can host their own
entitlement service.

---

## 9. Stripe billing wiring

The first-party `FIRST_PARTY_SKU_MAP`
(`packages/marketplace-stripe/src/pricing/sku-map.ts`, T-537) is
**frozen and explicitly excludes third-party SKUs**:

```ts
export const FIRST_PARTY_SKU_MAP: readonly SkuMapping[] = Object.freeze([
  { sku: 'news-pro-1y',         priceId: 'price_news_pro_1y_placeholder',         tier: 'paid-per-tenant' },
  { sku: 'sports-networks-1y',  priceId: 'price_sports_networks_1y_placeholder',  tier: 'paid-per-tenant' },
  { sku: 'creator-style-1y',    priceId: 'price_creator_style_1y_placeholder',    tier: 'paid-per-tenant' },
  { sku: 'finance-1y',          priceId: 'price_finance_1y_placeholder',          tier: 'paid-per-tenant' },
  { sku: 'wedding-events-1y',   priceId: 'price_wedding_events_1y_placeholder',   tier: 'paid-per-tenant' },
  { sku: 'frontier-fx-1y',      priceId: 'price_frontier_fx_1y_placeholder',      tier: 'paid-per-tenant' },
]);
```

Third-party publishers DO NOT register SKUs into this map. Two
options:

1. **Stripe Connect** (StageFlip-mediated): the marketplace operator
   issues a Stripe Connect account for the publisher and the
   marketplace handles checkout / payout. Revenue split per the
   Publisher Agreement.
2. **Self-bill** (publisher-mediated): the publisher operates their
   own Stripe (or other-PSP) account and exposes the entitlement
   verifier sidecar (§8.1) to gate installs.

Both options are gated on the **Publisher Agreement** clause in
[`docs/legal-review-marketplace.md`](legal-review-marketplace.md)
(currently `pending-counsel-review`); do not ship a paid third-party
pack until that clause is signed.

---

## 10. Pack lifecycle and upgrades

### 10.1 5-state TenantEntitlement

`TenantEntitlement.status` from `@stageflip/pack-loader`
(`packages/pack-loader/src/dependencies.ts`) per ADR-013 §D4:

| Status | Meaning | Loader admits? |
|---|---|---|
| `pending` | Checkout in flight, not yet active. | No |
| `active` | Tenant has a current entitlement. | Yes |
| `lapsed` | Subscription expired; grace window may apply. | No (caller may fold grace into `active` upstream via `LAPSED_GRACE_PERIOD_MS`) |
| `revoked` | Explicitly terminated (refund, dispute, abuse). | No; runtime emits `LF-LICENSE-CLIP-REVOKED` mid-session |
| `trial` | T-505 trial-mode sibling of `active`. | Yes; runtime emits `LF-LICENSE-TRIAL-ACTIVE` (warn) for watermarking |

### 10.2 Upgrade planner

`planUpgrade` (`packages/pack-loader/src/upgrade-planner.ts`, T-540)
classifies each installed pack against a target engine version into
one of four `PackUpgradeStatus` values:

| Status | Trigger |
|---|---|
| `compatible` | pack's `platformCompatibility` admits target AND `manifestVersion` is read by some `COMPATIBILITY_MATRIX` row |
| `needs-upgrade` | pack incompatible BUT a newer catalogue version of the same pack is compatible |
| `blocked` | incompatible AND no compatible newer version known |
| `manifest-version-incompatible` | target engine doesn't read this `manifestVersion` at all |

Publishers SHOULD bump `version` (semver) on every release and keep
`platformCompatibility` ranges honest — overly-loose ranges break
tenants when the engine ships a non-additive change; overly-tight
ranges force unnecessary republishing.

---

## 11. Telemetry contract

`@stageflip/pack-telemetry` (T-503) defines three event kinds — the
pack does NOT emit telemetry directly; the engine emits these on
behalf of installed packs:

| Event | When | Fields (selected) |
|---|---|---|
| `install` | Once per (tenant, pack, version) on successful loader register | `packIdHash`, `packVersion`, `licenseKind`, `engineVersion`, `platform` |
| `activation` | Once per reporting window | `packIdHash`, `mountedAnyClip` |
| `usage` | Aggregate over the window | `packIdHash`, `clipMountCount`, `windowSeconds` |

`packIdHash` is `SHA-256(<publisherId>/<packId>)` per `hashPackId` in
`packages/pack-telemetry/src/redact.ts` — plaintext publisher / pack
names are NEVER transmitted.

The receiver (T-541
`@stageflip/marketplace-telemetry-dashboard`) hashes its own
`FIRST_PARTY_PACK_IDS` list and aggregates only matching events into
the first-party dashboard. **Third-party packs are accepted by the
ingest path but are not aggregated to the first-party dashboard** —
publishers operating under path B who want their own telemetry should
configure their sidecar to consume a parallel stream.

Telemetry is **opt-in only** per ADR-001; the recorder constructed
with `enabled: false` is a silent no-op.

---

## 12. Tier policy

`@stageflip/marketplace-tier` (T-543) is a tier-resolution library.
`resolveTenantTier` returns one of four `TenantTier` values:

| Tier | Trigger |
|---|---|
| `free` | `license.kind === 'open'` (no entitlement required) |
| `paid` | `license.kind === 'paid-per-tenant'` AND entitlement is `active` or `trial` |
| `enterprise` | `license.kind === 'enterprise'` AND entitlement is `active` AND `contractRef` is non-empty |
| `none` | No usable entitlement (missing / pending / lapsed / revoked / enterprise-without-contractRef) |

The tier system is allow-list semantics: only an entitlement explicitly
in the right state grants access. `tierGate` consumes the resolved
tier plus a configurable `TierPolicyConfig`
(`DEFAULT_TIER_POLICY`, `LAPSED_GRACE_PERIOD_MS`,
`TRIAL_GRACE_PERIOD_MS`).

Per-tier limits are encoded as `DEFAULT_TIER_LIMITS` and may be
overridden per-deployment.

### 12.1 Trial behavior (T-544)

The `@stageflip/marketplace-conversion` (T-544) `planConversion`
function plans the upsell flow when a `trial` entitlement nears
expiry. Default churn-recovery defaults are exported as
`DEFAULT_CHURN_STRATEGY`, `DEFAULT_BASE_BACKOFF_MS`,
`DEFAULT_MAX_BACKOFF_MS`, and `DEFAULT_MAX_RETRIES`.

---

## 13. Refund / dispute defaults

`@stageflip/marketplace-refunds` (T-545) `DEFAULT_REFUND_POLICY` per
ADR-013 §D11:

| Window (days) | Refund | Entitlement |
|---|---|---|
| 0 – 7 (`DEFAULT_FULL_REFUND_WINDOW_DAYS`) | Full | Revoked |
| 7 – 30 (`DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS`) | Pro-rata: `1 - (elapsedDays / proRataRefundWindowDays)` clamped to `[0,1]` | Preserved by default (`preserveEntitlementForPartial: true`) |
| 30 – 60 (`DEFAULT_NO_REFUND_AFTER_DAYS`) | Pro-rata still admissible up to cutoff | Preserved (default) |
| > 60 | Denied | Untouched |

By publishing under the marketplace's default policy, the publisher
opts into these windows. Custom per-SKU policies are injectable via
the `processRefund` opts. Disputes are handled separately by
`handleDispute` + `buildDisputeEvidence`; the publisher should ensure
the marketplace can answer with usage metrics + customer info.

---

## 14. Loss-flag catalogue (8 codes)

All eight LF codes a pack can trigger, exported from
`@stageflip/pack-format` as `PACK_FORMAT_LF_CODES` /
`PACK_FORMAT_LF_SPECS`
(`packages/pack-format/src/loss-flags.ts`):

| Code | Severity | Trigger |
|---|---|---|
| `LF-LICENSE-PACK-DENIED` | `error` | Install-time entitlement check failed for a paid / enterprise pack (ADR-012 §D10). |
| `LF-LICENSE-CLIP-REVOKED` | `warn` | Mid-session entitlement revocation — clip falls back to `staticFallback` (ADR-012 §D6). |
| `LF-PACK-SIGNATURE-INVALID` | `error` | Ed25519 verification failed (key mismatch or tampered archive). |
| `LF-PACK-INCOMPATIBLE-VERSION` | `error` | Pack's `platformCompatibility` does not match host engine version. |
| `LF-PACK-MANIFEST-PARSE-ERROR` | `error` | `manifest.json` rejected by `packManifestSchema` at parse time. |
| `LF-LICENSE-TRIAL-ACTIVE` | `warn` | Pack with trial entitlement mounted a clip; output is watermarked (T-505). |
| `LF-LICENSE-TRIAL-EXPIRED` | `error` | Pack with trial entitlement attempted to mount after `expiresAt`; runtime denies (T-505). |
| `LF-NPM-TOKEN-MISSING` | `error` | npm-based install path could not find a tenant-scoped npm auth token for the publisher scope of a paid / enterprise pack (ADR-014 §D2 + T-539). |

Source: `packages/pack-format/src/loss-flags.ts`.

---

## 15. Quality gates publisher must pass

The publisher-side equivalents of the workspace gates. These are
NOT enforced by the marketplace — the marketplace enforces
signature verification, integrity-hash matching, manifest-schema
parse, and parity-fixture scoring (when fixtures are shipped) on the
upload. Everything else is the publisher's responsibility.

| Gate | What it checks | Tooling |
|---|---|---|
| Per-pack `typecheck` | TS strict | your repo's `tsc --noEmit` |
| Per-pack `lint` | code style | your tooling of choice (Biome recommended) |
| Per-pack `test` | unit tests on manifest + presets | Vitest / Jest |
| `stageflip-pack-publish validate` | T-499 pack-integrity invariants | bundled |
| Integrity-hash verification | SHA-256 of archive bytes matches `manifest.integrity.hash` | computed by `sign` |
| Signature verification | Ed25519 detached signature round-trips against the bound public key | `stageflip-pack-sign verify` |
| `validatePackFixtures` | PSNR + SSIM per cluster threshold (when shipping fixtures) | `@stageflip/pack-parity-validator` |

Run all gates green before publishing.

---

## 16. Submitting and updating

### 16.1 Publish flow

1. **Build** — render the manifest from your typed skeleton, walk the
   source dir, synthesize the SFPACK1 archive (the in-workspace
   first-party packs use a `scripts/build-pack.ts` per
   `packages/pack-news-pro/scripts/build-pack.ts`).
2. **Sign** — `stageflip-pack-sign sign` (or
   `stageflip-pack-publish sign`).
3. **Validate** — `stageflip-pack-publish validate` against the
   source dir.
4. **Upload** — `stageflip-pack-publish publish ... --registry ...`
   (path A) or `npm publish` (path B).

### 16.2 Version bumps

Versions are immutable on the registry (`409 conflict /
version-already-published`). To ship a fix, bump `manifest.version`
(SemVer) and republish. Patch-level bumps are appropriate for
preset-content fixes; minor for additive contribution rows; major
for breaking schema changes.

### 16.3 Deprecation

Publishers signal deprecation via a new version that downgrades the
`platformCompatibility` range or empties `contributes`. The
marketplace does not currently expose a hard "deprecate" flag;
deprecation is communicated to tenants via the publisher's own
channels and via the `planUpgrade` `blocked` status when the
publisher releases no new compatible versions.

### 16.4 Churn-recovery defaults

`@stageflip/marketplace-conversion` defaults
(`DEFAULT_CHURN_STRATEGY`, `DEFAULT_BASE_BACKOFF_MS`,
`DEFAULT_MAX_BACKOFF_MS`, `DEFAULT_MAX_RETRIES`) drive the conversion
planner's retry behavior on lapsed-recovered + trial-expired
triggers. Publishers operating under the marketplace's default
billing path inherit these; custom policies require operator
coordination.

---

## 17. Reference: example minimal pack

`packages/pack-news-pro/` is the canonical real-world example —
smallest of the six v0.2.0 launch packs. Layout:

```
packages/pack-news-pro/
├── package.json
├── src/
│   ├── manifest.ts            # MANIFEST_SKELETON typed against PackManifest
│   └── manifest.test.ts
├── packs/
│   ├── LICENSE.md
│   ├── NOTICE.md
│   └── presets/
│       ├── sky-news-pro-register.md
│       ├── itv-pro-register.md
│       ├── rai-pro-register.md
│       └── premium-news-ticker.md
├── scripts/
│   ├── build-pack.ts          # synth + sign + emit manifest.json
│   └── build-pack.test.ts
├── keys/                      # publisher keys (gitignored in third-party setup)
└── dist/                      # built archive + signature + manifest.json
```

The `MANIFEST_SKELETON` is a typed `PackManifest` literal so the
build script + tests typecheck against the same source of truth. The
build script computes the SHA-256 over the synthesized archive,
re-emits `manifest.json` with the real hash via `withIntegrityHash`,
re-archives, and signs.

The pack ships **presets only** — no `clipKinds`, no fixtures. The
Cluster A clip kinds it consumes (`news-ticker`, `lower-third`,
`breaking-banner`) live in the engine since Phase 13.

For the corresponding concept skill see
`skills/stageflip/concepts/pack-news-pro/SKILL.md`. Replicate this
shape for your own pack — it's the minimum-viable template for a
content-only pack on cluster A.

---

## Further reading

- [ADR-012 — Bundle format, license-runtime](decisions/ADR-012-bundle-format-license-runtime.md)
- [ADR-013 — Pack catalogue, pricing tiers](decisions/ADR-013-pack-catalogue-pricing-tiers.md)
- [ADR-014 — Marketplace](decisions/ADR-014-marketplace.md)
- [Marketplace legal-review checklist](legal-review-marketplace.md)
- [Architecture overview](architecture.md)
