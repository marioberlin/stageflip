# ADR-012: Bundle Format & License Runtime

**Date**: 2026-05-13
**Ratified**: 2026-05-14 (orchestrator approval; post-Phase-16 close)
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 16 (Bundles & Marketplace) ships the **OSS-path optionality**:
turns the skill-tree + adapter architecture into a marketplace of
paid content (preset packs / cluster extensions / adapter packs /
asset packs / theme packs / composition templates). Six first-party
launch packs (News Pro / Sports Networks / Creator Style / Earnings
& Investor / Wedding & Events / Frontier Effects). License runtime
gates paywall-locked clips at instantiation; OSS core + paid content
coexist.

This ADR is the **first of three Phase 16 α hard-gate ADRs**
(ADR-013 Pack Catalogue + ADR-014 Marketplace follow; together they
block T-493+). It defines:

1. The **bundle manifest spec** — what's in a `.stageflip-pack`
   archive (filesystem layout + manifest fields).
2. The **signature scheme** — cryptographic verification of bundle
   authenticity at install + at instantiation.
3. The **license-claim format** — how a pack declares its license
   terms (open vs. paid; per-tenant entitlement format).
4. The **version compatibility model** — how a pack pins to a
   StageFlip platform version range + how the loader reconciles
   compatibility at load time.
5. The **license-runtime enforcement** — where in the dispatch chain
   the license gate fires; failure-mode UX.

After this ADR + ADR-013 (T-491) + ADR-014 (T-492) merge, **all** of
T-493+ can dispatch: bundle concept SKILL (T-493), `@stageflip/pack-format`
(T-494), `@stageflip/pack-loader` (T-495), and the six first-party
launch packs (T-500+).

### What this ADR is **not**

- **Not the catalogue ADR.** ADR-013 (T-491) decides what we sell + the
  pricing tier structure (free / paid / enterprise). This ADR is
  format-side.
- **Not the marketplace ADR.** ADR-014 (T-492) decides hosting (dedicated
  registry vs. npm + scoped + auth). This ADR is content-format-side.
- **Not the per-pack ADR.** Each of the six launch packs has its own
  pack-spec doc; this ADR specifies the format the packs conform to.
- **Not a code or schema PR.** Pure docs ADR. The contract shapes
  specified here land in `@stageflip/pack-format` (T-494); the loader
  in T-495; the runtime gate in a downstream task.

---

## Decisions

### D1. Bundle format = signed tarball with strict manifest

A StageFlip pack is a `.stageflip-pack` file: a deterministic-tar +
zstd-compressed archive containing a top-level `manifest.json` + the
pack's content (presets, clip implementations, fonts, assets,
fixtures). The format is **content-addressed**: the manifest's
`integrity` field carries a SHA-256 of the tar bytes; the loader
verifies on read.

**Why a tarball (not a zip)**. Deterministic-tar (sorted entries +
fixed mtime + numeric uid/gid) produces byte-identical output for
identical content, enabling reproducible builds + signature
verification. Zip's standard implementations are non-deterministic
(varying compression-level metadata, file ordering).

**Why zstd (not gzip)**. zstd is 30-50% smaller than gzip at equivalent
decompression cost; the workspace already uses zstd elsewhere (T-203
parity-render artifact compression). License whitelist: zstd is BSD.

**Filesystem layout** inside the tarball:

```
.stageflip-pack/
  manifest.json                  // strict per D2
  signature.bin                  // detached signature; per D3
  presets/<cluster>/<id>.md      // preset markdown
  clips/<clipKind>/              // optional clip implementations
  fonts/<family>/                // optional font assets (T-189 catalog)
  fixtures/<id>/                 // optional parity-fixture goldens
  assets/<path>                  // arbitrary asset content
```

Pack contents are read-only after sign — the loader rejects any
modification (integrity check catches it).

### D2. Manifest = strict Zod schema; required + optional fields

`manifest.json` parses against `packStreetManifestSchema` (Zod
`.strict()`). Required fields:

| Field | Type | Notes |
|---|---|---|
| `manifestVersion` | `'1'` (literal) | future-proofing; v2+ would land via ADR amendment. |
| `id` | `string` (kebab-case) | globally unique pack id within the marketplace. |
| `name` | `string` | human-readable display name. |
| `version` | semver | pack version; semver-respected by the loader. |
| `publisher` | `{ id: string, displayName: string }` | publisher identity (the holder of the signing key). |
| `platformCompatibility` | `string` (semver range) | StageFlip platform version range this pack targets. |
| `license` | `LicenseClaim` per D4 | per-pack license declaration. |
| `integrity` | `{ algorithm: 'sha256', hash: hex }` | computed at sign time over the tar bytes excluding `signature.bin`. |
| `contributes` | `PackContributions` | declares what the pack ships (presets / clips / fonts / fixtures / assets) per D5. |

Optional fields: `description`, `homepage`, `repository`, `keywords`,
`dependsOn` (other pack ids), `requiresAdapter` (audience-backend /
asset-gen modality dependencies).

**Why strict**: typo in a field name fails loud at install time, not
mysteriously at runtime. Matches the T-411a tenant-settings posture.

### D3. Signature scheme = Ed25519 detached signature; publisher keys distributed via ADR-014

`signature.bin` is an Ed25519 signature over the tar bytes excluding
itself. The publisher signs with their private key; the loader
verifies against the publisher's public key.

Public-key distribution is **out-of-band** per ADR-014:

- For first-party packs: bundled with `@stageflip/pack-loader` at
  publication time.
- For third-party packs: served via the marketplace registry's HTTPS
  endpoint (TOFU + pinned-on-trust by tenants).

**Why Ed25519 (not RSA)**. Ed25519 is smaller (signature is 64 bytes),
faster, and post-quantum-vulnerable in the same way RSA is — neither
is a long-term solution but Ed25519's modern primitive surface area is
smaller. License whitelist: Ed25519 implementations in `@noble/ed25519`
are MIT.

**Why detached (not embedded)**. Embedded signatures complicate the
integrity hash (chicken-and-egg). Detached is canonical for tar-style
content addressing.

**Signature failure** at load time is a **hard error**: the pack does
NOT load. There's no graceful-degrade-to-OSS-content path; the user
sees a clear "Pack signature invalid" message + the tenant-admin's
remediation contact.

### D4. License-claim format = enum + per-tier metadata

```typescript
type LicenseClaim =
  | { kind: 'open'; spdx: 'MIT' | 'Apache-2.0' | 'CC-BY-4.0' | 'CC0-1.0' }
  | { kind: 'paid-per-tenant'; sku: string; entitlementType: 'subscription' | 'one-time' }
  | { kind: 'enterprise'; sku: string; contractRef?: string };
```

- **`open`** packs ship under a permitted OSS license. The runtime
  gate is a no-op (always passes). License-whitelist enforcement
  catches unknown SPDX strings at install.
- **`paid-per-tenant`** packs require the tenant to hold a valid
  entitlement for the declared `sku`. `entitlementType` distinguishes
  subscription (must be active) from one-time-purchase (must have
  been purchased; no expiry).
- **`enterprise`** packs require an enterprise contract reference;
  entitlement verification routes via the enterprise-license
  endpoint (out of v1; T-540+ marketplace-tier).

**Entitlement check** happens at TWO points (per D6):
1. Install time — pack-loader refuses to load if the tenant lacks
   entitlement.
2. Clip-instantiation time — runtime refuses to mount clips
   contributed by an entitlement-revoked pack.

### D5. PackContributions = closed enum + per-kind manifest

```typescript
interface PackContributions {
  readonly presets?: readonly { id: string; cluster: string }[];
  readonly clipKinds?: readonly { kind: string; module: string }[];
  readonly fonts?: readonly { family: string; license: string }[];
  readonly fixtures?: readonly { id: string }[];
  readonly assets?: readonly { path: string; mimeType: string }[];
  readonly tools?: readonly { bundleName: string; tools: string[] }[];
  readonly adapters?: readonly { id: string; modality: string }[];
  readonly themePacks?: readonly { id: string }[];
}
```

Each kind has a CI-time validator (extends existing
`check-asset-licenses` / `check-skill-drift` / `check-audience-permissions`
patterns).

**Why one declaration per kind** (vs. a generic `files: string[]`):
the manifest is the source of truth for what the loader trusts +
what the runtime registers. A typo in a path is caught at manifest
parse, not at runtime when the path doesn't resolve.

### D6. License-runtime enforcement — two-point gate

The license runtime checks entitlements at:

1. **Pack-loader install/load** (`@stageflip/pack-loader` per T-495):
   - Reads tenant's entitlement set from a `TenantEntitlementsStore`
     (new facet per T-496; mirrors `TenantSettingsStore` T-411a).
   - Refuses to load a `paid-per-tenant` / `enterprise` pack if the
     tenant lacks entitlement.
   - Surfaces a `LF-LICENSE-PACK-DENIED` loss flag (added to the
     P14 / P15 loss-flag inventory in a downstream task).

2. **Clip-instantiation** (renderer-core dispatcher; T-497 wires):
   - When `findClip(kind)` resolves to a clip contributed by a
     paid pack, re-checks entitlement (defends against revocation
     after load).
   - On revocation: the clip's `liveMount` path is denied; the
     `staticFallback` path renders normally if the snapshot bytes
     are still cached (existing P15 §13 §D4 + ADR-008 §D2 posture
     — staticFallback is durability-of-cache, not durability-of-
     entitlement; documented as known limitation).

**Why two-point**: an entitlement can revoke mid-session (e.g.,
subscription lapses). Install-only check would miss this; runtime-
only check would re-check on every frame (expensive + slow). The
two-point compromise: fast load-time block + cheap per-mount re-check.

**Failure-mode UX**:
- Install-time denial: surface in the editor as "This pack requires
  an entitlement your tenant doesn't hold. Contact your admin."
- Runtime-time denial mid-session: clip falls back to staticFallback
  + a small "License expired" badge.

### D7. Version compatibility — semver range; loader resolves

`platformCompatibility` is a semver range string (e.g.,
`'^16.0.0'`). The loader compares to the host StageFlip platform
version (a `version.ts` constant the loader imports at boot).

- **Match**: pack loads.
- **Mismatch**: pack does NOT load; loader emits a
  `LF-PACK-INCOMPATIBLE-VERSION` flag with the declared range + the
  actual version.

The loader keeps an in-memory index of loaded packs; reloading after
a platform upgrade re-runs the compatibility check. Tenants pin pack
versions in their `tenant-packs.json` (a sibling of
`tenant-settings.json`); upgrades require explicit re-pinning.

### D8. Pack discovery + storage

Packs live at `~/.stageflip/packs/<publisher>/<pack-id>/<version>/`
on the local filesystem (per ADR-014). The pack-loader walks this
tree at boot + at filesystem-change events.

For headless / Cloud Run deployments, packs are pre-staged at image
build time + mounted read-only.

### D9. Determinism posture

`@stageflip/pack-format` + `@stageflip/pack-loader` are **outside
the determinism perimeter** (`packages/runtimes/**` is the
perimeter per CLAUDE.md §3). Loader uses Node-only primitives
(`node:fs`, `node:crypto` for Ed25519 via `@noble/ed25519`).

Packs CAN contribute clip implementations that ARE inside the
determinism perimeter (e.g., a shader pack contributing a
`ShaderClip` variant). The clip's source is responsible for its
own determinism contract; the pack format imposes no additional
constraints beyond what existing determinism gates already enforce.

### D10. Loss flags

5 new `LF-LICENSE-*` / `LF-PACK-*` codes (extends the existing
`LF-AUDIENCE-*` / `LF-ASSET-GEN-*` pattern):

| Code | Severity | Trigger |
|---|---|---|
| `LF-LICENSE-PACK-DENIED` | error | Install-time entitlement check failed |
| `LF-LICENSE-CLIP-REVOKED` | warn | Mid-session entitlement revocation |
| `LF-PACK-SIGNATURE-INVALID` | error | Ed25519 verification failed |
| `LF-PACK-INCOMPATIBLE-VERSION` | error | platformCompatibility mismatch |
| `LF-PACK-MANIFEST-PARSE-ERROR` | error | manifest.json rejects by Zod |

Land in `@stageflip/loss-flags` via T-494.

### D11. Plugin manifest extensions (Phase 16 marketplace alignment)

Per ADR-007 §D12 (plugin marketplace alignment), packs participate
in the existing plugin-manifest contribution-kind system. The five
existing contribution kinds (clip-runtime / asset-gen-provider /
audience-backend-provider / preset / theme) are joined by:

- `pack` — generic content pack (presets + fixtures + fonts).
- `clip-pack` — clip implementations only.
- `adapter-pack` — `AudienceBackendProvider` / asset-gen provider
  packs (e.g., a third-party voice provider).
- `theme-pack` — `Theme` declarations + supporting fonts.

Plugin ratification at install time validates the pack's
contributions match the declared kind.

### D12. Out of scope (deferred to downstream ADRs)

| Item | Deferred to |
|---|---|
| Pricing model (free / paid / enterprise tier specifics) | ADR-013 |
| Marketplace hosting + auth (dedicated registry vs. npm + scoped) | ADR-014 |
| Per-pack ratification process (vs. plugin ratification) | T-498 |
| Tenant-entitlement revocation flow | T-496 (TenantEntitlementsStore) |
| Receipt / billing integration | Out of v1; punted to T-540+ |
| Cross-platform pack format (browser vs. Node loader) | T-495 covers both; this ADR is content-format-side. |

---

## Rejected alternatives

### A. Use npm packages directly (no `.stageflip-pack` format)

**Rejected per §D1.** npm packages are tree-shaken at bundle time,
inappropriate for content packs (no executable code surface for
markdown / fixtures / fonts). npm scope-based auth doesn't compose
with per-tenant entitlement. The signed-tarball format is purpose-
built for content distribution.

### B. Embedded signatures inside manifest.json

**Rejected per §D3.** Signing the manifest requires computing the
manifest's integrity hash first, but the hash includes the signature
field — chicken-and-egg. Detached signature is canonical for
content-addressed archives.

### C. RSA-2048 signatures

**Rejected per §D3.** Ed25519 is smaller, faster, equally secure for
the threat model. RSA's only advantage (older platform support) is
moot — `@noble/ed25519` works in Node + browser. Future-quantum
both are vulnerable; that's a 10+ year horizon.

### D. Per-clip license claims (not per-pack)

**Rejected per §D4.** Per-clip claims would require a license check on
every clip-instantiation across hundreds of clips per slide.
Per-pack claims allow one check per pack-load + cheap per-instantiation
re-check against the in-memory pack registry.

### E. License revocation = hard mid-session disconnect

**Rejected per §D6.** Disconnecting mid-presentation is unacceptable
UX. Falling back to staticFallback + a "License expired" badge
preserves the running session + signals the issue clearly.

### F. No version compatibility check (let it fail at runtime)

**Rejected per §D7.** Failing at runtime is worse than failing at
load — runtime failures appear mid-session; load failures appear at
boot when the admin can act on them.

---

## Consequences

### Positive

- **Tenant-marketplace business model becomes possible.** Packs can be
  sold + entitlement-gated without re-architecting the core.
- **OSS / paid coexistence.** The runtime is mode-agnostic; an OSS-only
  tenant sees no friction.
- **First-party launch packs viable.** Six launch packs (T-500+) have a
  format to ship into.
- **Future third-party authoring.** Phase 17+ can open the marketplace
  to third parties without ADR work.

### Negative

- **Marketplace operational cost.** Hosting + signing keys + entitlement
  service. ADR-014 evaluates.
- **Per-pack license review.** Each first-party pack needs a license
  audit pre-launch (CC-BY attribution chains, font licenses, etc.).
- **License-runtime is a new dispatch layer.** Adds latency to clip
  mount (target: <1ms per mount via in-memory entitlement cache).

---

## Downstream consumers

- **T-491** (ADR-013 Pack Catalogue) defines pricing tiers + the six
  launch packs. References `LicenseClaim.sku` from §D4.
- **T-492** (ADR-014 Marketplace) defines hosting + signing-key
  distribution. References §D3 + §D8.
- **T-493** (concept SKILL) writes `skills/stageflip/concepts/bundles/SKILL.md`.
- **T-494** (`@stageflip/pack-format`) ships the Zod manifest schema +
  signature utilities + `LF-PACK-*` codes per §D10.
- **T-495** (`@stageflip/pack-loader`) ships the filesystem walker +
  entitlement check + integrity verification per §D6.
- **T-496** (`TenantEntitlementsStore`) ships the storage facet for
  per-tenant entitlement sets per §D4 / §D6.
- **T-497** wires the runtime gate into renderer-core's `findClip`
  dispatch per §D6.
- **T-498** plugin-ratification extension recognizing the four new
  contribution kinds per §D11.
- **T-500..T-505** the six first-party launch packs.

---

## §13 (structural extension) statement

**NOT a structural extension** — pure docs ADR. The schema additions
this ADR specifies (`packManifestSchema`, `LicenseClaim`,
`PackContributions`) land in T-494 (`@stageflip/pack-format`); the
runtime gate lands in T-497; the entitlement store lands in T-496.
Each of those DOES bear the §13 obligation; their PR bodies cite
this ADR.

Render verification N/A.

---

## Open questions (to be resolved in downstream specs)

- Per-pack integrity check cadence — boot only vs. periodic?
  Recommendation: boot + on filesystem-change. (T-495 decides.)
- Entitlement cache TTL — how long is an in-memory entitlement check
  trusted before re-validation against the store? Recommendation:
  60s + revalidate-on-mount. (T-497 decides.)
- Per-pack analytics — does the host emit usage telemetry per loaded
  pack? Recommendation: yes, via the existing `AdapterUsageEvent`
  pattern (T-445) with a `packId` field. (T-495 may pre-empt this.)
