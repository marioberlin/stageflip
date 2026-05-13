---
title: Wedding & Events Pack
id: skills/stageflip/concepts/pack-wedding-events
tier: concept
status: placeholder
last_updated: 2026-05-13
owner_task: T-526
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
  - skills/stageflip/concepts/pack-trial/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/pack-news-pro/SKILL.md
  - skills/stageflip/concepts/pack-sports-networks/SKILL.md
  - skills/stageflip/concepts/pack-creator-style/SKILL.md
  - skills/stageflip/concepts/pack-finance/SKILL.md
  - skills/stageflip/concepts/presets/SKILL.md
---

# Wedding & Events Pack

`@stageflip/pack-wedding-events` is StageFlip's **fifth first-party
launch pack** — a commercial-subscription content bundle declaring a
NEW wedding-events-vertical cluster (`cluster-wedding-events`) with
theme variants (rustic / modern / classic), composition templates,
wedding-specific transitions + bumpers, and a pre-licensed audio bed
library for the wedding-events use case. It is shipped under the
`paid-per-tenant` license tier per ADR-013 §D3 with SKU
`wedding-events-1y`.

The pack does NOT ship clip code. The underlying clip kinds the theme
variants + composition templates consume live in the engine since
Phase 13. The pack contributes presets only — declarative markdown
bodies the engine compiles into RIR at clip-mount time.

## What makes this pack different

News Pro (T-506..T-510), Sports Networks (T-511..T-515), and Creator
Style (T-516..T-520) all contribute **per-brand registers** within
existing alphabetic clusters (cluster-a / cluster-b / cluster-f).
Earnings & Investor (T-521..T-525) broke that pattern as the first
vertical-use-case cluster (`cluster-finance`). Wedding & Events is
the second vertical-use-case launch pack:

1. **Vertical-use-case cluster.** The four placeholders declare the
   new `cluster-wedding-events` cluster — a vertical-use-case
   discriminant rather than an alphabetic one. `cluster` is a
   free-form string in the manifest schema
   (`packages/pack-format/src/manifest.ts`: `cluster:
   z.string().min(1)`), so declaring a new vertical cluster is purely
   a content-side metadata operation. No clip-code change.
2. **Lifecycle-event content shape.** Rather than three / four
   brand-keyed register variants of the same clip kind, the pack
   contributes theme variants (T-527), composition templates (T-528),
   transitions + bumpers (T-529), and a pre-licensed audio bed
   library (T-530). Each fills a different need than a brand
   register.

## The five-task arc

| Task | Ships |
|---|---|
| **T-526** (this skeleton) | Pack-source dir + `scripts/build-pack.ts` + four placeholder presets + LICENSE/NOTICE + npm shim |
| T-527 | Rustic theme variant (one of three theme variants — rustic / modern / classic) — fills in `rustic-theme-placeholder.md` |
| T-528 | Wedding composition templates — fills in `wedding-composition-templates-placeholder.md` |
| T-529 | Wedding-specific transitions + bumpers — fills in `wedding-transitions-placeholder.md` |
| T-530 | Pre-licensed audio bed library — fills in `audio-bed-library-placeholder.md` |

After T-530 the pack flips from skeleton (placeholder presets) to
consumer-ready (signed archive matches `check-pack-integrity` gate
expectations + presets render observable output per CLAUDE.md §13).

## What's in the pack-source dir

```
packages/pack-wedding-events/packs/
  presets/
    rustic-theme-placeholder.md                  (T-526; T-527 fills in)
    wedding-composition-templates-placeholder.md (T-526; T-528 fills in)
    wedding-transitions-placeholder.md           (T-526; T-529 fills in)
    audio-bed-library-placeholder.md             (T-526; T-530 fills in)
  LICENSE.md                                     (commercial-subscription template)
  NOTICE.md                                      (commercial-subscription template)
```

The build script (`scripts/build-pack.ts`) walks this directory,
synthesizes a deterministic SFPACK1 archive (per
`@stageflip/pack-signing/archive`), signs it with the dev Ed25519
private key, computes the SHA-256 integrity hash, and emits the final
trio of files to `packs/stageflip/wedding-events/0.1.0/`:

- `archive.sfpack` — signed archive bytes.
- `signature.bin` — 64-byte detached Ed25519 signature.
- `manifest.json` — manifest with `integrity.hash` patched to match.

## The npm shim (`@stageflip/pack-wedding-events`)

The `packages/pack-wedding-events/` directory is a private workspace
package (it is **not** published to npm; never will be). It exists
so:

1. The editor surface can `import { MANIFEST_SKELETON } from
   '@stageflip/pack-wedding-events'` and typecheck against the pack
   metadata.
2. The `scripts/build-pack.ts` build script lives next to the
   manifest source-of-truth so the signing pipeline is auditable +
   reproducible.
3. The pack-source dir + dev keys live in a workspace package so they
   are versioned + reviewed alongside the rest of the codebase, not
   as loose files under a `packs/` top-level root.

## Manifest highlights

```jsonc
{
  "manifestVersion": "1",
  "id": "wedding-events",
  "name": "Wedding & Events",
  "version": "0.1.0",
  "publisher": { "id": "stageflip", "displayName": "StageFlip" },
  "platformCompatibility": "^2.0.0",
  "license": {
    "kind": "paid-per-tenant",
    "sku": "wedding-events-1y",
    "entitlementType": "subscription"
  },
  "integrity": { "algorithm": "sha256", "hash": "<computed by build-pack>" },
  "contributes": {
    "presets": [
      { "id": "rustic-theme-placeholder",                  "cluster": "cluster-wedding-events" },
      { "id": "wedding-composition-templates-placeholder", "cluster": "cluster-wedding-events" },
      { "id": "wedding-transitions-placeholder",           "cluster": "cluster-wedding-events" },
      { "id": "audio-bed-library-placeholder",             "cluster": "cluster-wedding-events" }
    ]
  }
}
```

The integrity hash is intentionally a zeros-placeholder in the TS
skeleton (`MANIFEST_SKELETON` in `src/manifest.ts`); the build script
substitutes the real SHA-256 over the archive bytes (excluding the
manifest itself) at sign time.

## The `cluster-wedding-events` vertical cluster

`cluster-wedding-events` is the second vertical-use-case cluster
declared in a first-party pack manifest (after `cluster-finance` in
T-521). It is NOT an alphabetic cluster (a/b/c/…/g) and it is NOT a
clipKind discriminant. It is a content-side metadata label on
`contributes.presets[].cluster` that lets the editor surface and the
marketplace group + filter the four wedding-events presets as a
coherent unit.

`check-skill-drift` enforces preset ↔ cluster directory parity by
walking `skills/stageflip/presets/<cluster>/` — it does not maintain
an allowlist of cluster names from pack manifests. No allowlist
update is required for T-526. (T-530 may add a
`skills/stageflip/presets/cluster-wedding-events/SKILL.md` if the
wedding-events presets warrant a presets-tier cluster skill, but that
is a T-530 concern, not T-526.)

## Determinism perimeter

`@stageflip/pack-wedding-events` lives **OUTSIDE** the determinism
perimeter per CLAUDE.md §3: it's a content package + host-side
tooling. The preset markdown bodies are declarative — no code runs
from this package at clip-render time. The build script is
publisher-side tooling and uses `Date`-free crypto primitives.

## The dev keypair

`keys/wedding-events-dev.{public,private}.pem` is a **DEVELOPMENT
keypair** committed into the repo for local + CI signing roundtrip.
It is NOT the production publisher key. The loader's
trusted-publisher pin per tenant means the dev key cannot sign packs
admitted into any production tenant. The dev key is rotated at
marketplace launch (T-543) per ADR-013 §D5.

## Relationship to the prior four launch packs

Wedding & Events is the **fifth** first-party launch pack; News Pro
(T-506 skeleton → T-510 GA, v0.2.0), Sports Networks (T-511 skeleton
→ T-515 GA, v0.2.0), Creator Style (T-516 skeleton → T-520 GA,
v0.2.0), and Earnings & Investor (T-521 skeleton → T-525 GA, v0.2.0)
precede it. The five packs share:

- the same `paid-per-tenant` commercial-subscription license tier
  (ADR-013 §D3);
- the same pack-source layout + `scripts/build-pack.ts` signing
  pipeline;
- the same DEV-ONLY keypair-rotation-at-marketplace-launch policy.

They differ in:

- the clusters they extend (News Pro → `cluster-a`, Sports Networks →
  `cluster-b`, Creator Style → `cluster-f`, Earnings & Investor →
  vertical `cluster-finance`, Wedding & Events → vertical
  `cluster-wedding-events`);
- the content shape (News Pro / Sports Networks / Creator Style:
  per-brand register variants. Earnings & Investor: vertical
  composition templates + adapter tier + semantic-tools extension.
  Wedding & Events: theme variants + composition templates +
  transitions/bumpers + audio bed library);
- the SKU pricing (each tier negotiated independently per ADR-013).

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (manifest + signing
  contract this pack implements).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers (the
  catalogue this pack joins as the fifth row).
