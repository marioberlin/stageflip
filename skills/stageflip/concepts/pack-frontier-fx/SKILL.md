---
title: Frontier Effects Pack
id: skills/stageflip/concepts/pack-frontier-fx
tier: concept
status: placeholder
last_updated: 2026-05-13
owner_task: T-531
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
  - skills/stageflip/concepts/pack-trial/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/pack-news-pro/SKILL.md
  - skills/stageflip/concepts/pack-sports-networks/SKILL.md
  - skills/stageflip/concepts/pack-creator-style/SKILL.md
  - skills/stageflip/concepts/pack-finance/SKILL.md
  - skills/stageflip/concepts/pack-wedding-events/SKILL.md
  - skills/stageflip/concepts/presets/SKILL.md
---

# Frontier Effects Pack

`@stageflip/pack-frontier-fx` is StageFlip's **sixth + last
first-party launch pack** — a commercial-subscription content bundle
extending the existing `cluster-i` Live Audience cluster with
premium shaders, a pre-licensed commercial-OK 3D asset library,
premium ReactionStream particle physics presets, and premium
TitleSequence templates. It is shipped under the `paid-per-tenant`
license tier per ADR-013 §D3 with SKU `frontier-fx-1y`.

The pack does NOT ship clip code. The underlying clip kinds the
premium shaders + 3D assets + particle physics + TitleSequence
templates consume live in the engine (frontier-runtime work from P15
+ Track A). The pack contributes presets only — declarative markdown
bodies the engine compiles into RIR at clip-mount time.

## What makes this pack different

News Pro (T-506..T-510), Sports Networks (T-511..T-515), and Creator
Style (T-516..T-520) all contribute **per-brand registers** within
existing alphabetic clusters (cluster-a / cluster-b / cluster-f).
Earnings & Investor (T-521..T-525) broke that pattern as the first
vertical-use-case cluster (`cluster-finance`); Wedding & Events
(T-526..T-530) followed with `cluster-wedding-events`. Frontier
Effects is the **first runtime-feature-extension** launch pack:

1. **Runtime-feature extension.** The four placeholders declare
   contributions against the existing `cluster-i` cluster, which
   already groups the frontier-runtime work landed in P15 + Track A.
   `cluster` is a free-form string in the manifest schema
   (`packages/pack-format/src/manifest.ts`: `cluster:
   z.string().min(1)`), so reusing an existing cluster is purely a
   content-side metadata operation. No clip-code change.
2. **Premium-feature content shape.** Rather than brand-keyed
   register variants or vertical-use-case templates, the pack
   contributes premium shaders (T-532), a pre-licensed 3D asset
   library (T-533), premium ReactionStream particle physics presets
   (T-534), and premium TitleSequence templates (T-535). Each
   leverages the frontier-runtime surface area extended in Cluster I.

## The five-task arc

| Task | Ships |
|---|---|
| **T-531** (this skeleton) | Pack-source dir + `scripts/build-pack.ts` + four placeholder presets + LICENSE/NOTICE + npm shim |
| T-532 | Premium shaders — fills in `premium-shaders-placeholder.md` |
| T-533 | Pre-licensed commercial-OK 3D asset library — fills in `3d-asset-library-placeholder.md` |
| T-534 | Premium ReactionStream particle physics presets — fills in `reactionstream-physics-placeholder.md` |
| T-535 | Premium TitleSequence templates — fills in `titlesequence-premium-placeholder.md` |

After T-535 the pack flips from skeleton (placeholder presets) to
consumer-ready (signed archive matches `check-pack-integrity` gate
expectations + presets render observable output per CLAUDE.md §13).

## What's in the pack-source dir

```
packages/pack-frontier-fx/packs/
  presets/
    premium-shaders-placeholder.md          (T-531; T-532 fills in)
    3d-asset-library-placeholder.md         (T-531; T-533 fills in)
    reactionstream-physics-placeholder.md   (T-531; T-534 fills in)
    titlesequence-premium-placeholder.md    (T-531; T-535 fills in)
  LICENSE.md                                (commercial-subscription template)
  NOTICE.md                                 (commercial-subscription template)
```

The build script (`scripts/build-pack.ts`) walks this directory,
synthesizes a deterministic SFPACK1 archive (per
`@stageflip/pack-signing/archive`), signs it with the dev Ed25519
private key, computes the SHA-256 integrity hash, and emits the final
trio of files to `packs/stageflip/frontier-fx/0.1.0/`:

- `archive.sfpack` — signed archive bytes.
- `signature.bin` — 64-byte detached Ed25519 signature.
- `manifest.json` — manifest with `integrity.hash` patched to match.

## The npm shim (`@stageflip/pack-frontier-fx`)

The `packages/pack-frontier-fx/` directory is a private workspace
package (it is **not** published to npm; never will be). It exists
so:

1. The editor surface can `import { MANIFEST_SKELETON } from
   '@stageflip/pack-frontier-fx'` and typecheck against the pack
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
  "id": "frontier-fx",
  "name": "Frontier Effects",
  "version": "0.1.0",
  "publisher": { "id": "stageflip", "displayName": "StageFlip" },
  "platformCompatibility": "^2.0.0",
  "license": {
    "kind": "paid-per-tenant",
    "sku": "frontier-fx-1y",
    "entitlementType": "subscription"
  },
  "integrity": { "algorithm": "sha256", "hash": "<computed by build-pack>" },
  "contributes": {
    "presets": [
      { "id": "premium-shaders-placeholder",          "cluster": "cluster-i" },
      { "id": "3d-asset-library-placeholder",         "cluster": "cluster-i" },
      { "id": "reactionstream-physics-placeholder",   "cluster": "cluster-i" },
      { "id": "titlesequence-premium-placeholder",    "cluster": "cluster-i" }
    ]
  }
}
```

The integrity hash is intentionally a zeros-placeholder in the TS
skeleton (`MANIFEST_SKELETON` in `src/manifest.ts`); the build script
substitutes the real SHA-256 over the archive bytes (excluding the
manifest itself) at sign time.

## The `cluster-i` Live Audience cluster

`cluster-i` is the existing Live Audience cluster — already used by
frontier-runtime preset contributions from P15 + Track A. Reusing it
for Frontier Effects is intentional: the four placeholder
contributions sit alongside the existing frontier-runtime presets
under the same content cluster, so the editor surface and
marketplace surface them as a coherent runtime-feature-extension
unit.

`check-skill-drift` enforces preset ↔ cluster directory parity by
walking `skills/stageflip/presets/<cluster>/` — it does not maintain
an allowlist of cluster names from pack manifests. No allowlist
update is required for T-531.

## Determinism perimeter

`@stageflip/pack-frontier-fx` lives **OUTSIDE** the determinism
perimeter per CLAUDE.md §3: it's a content package + host-side
tooling. The preset markdown bodies are declarative — no code runs
from this package at clip-render time. The build script is
publisher-side tooling and uses `Date`-free crypto primitives.

## The dev keypair

`keys/frontier-fx-dev.{public,private}.pem` is a **DEVELOPMENT
keypair** committed into the repo for local + CI signing roundtrip.
It is NOT the production publisher key. The loader's
trusted-publisher pin per tenant means the dev key cannot sign packs
admitted into any production tenant. The dev key is rotated at
marketplace launch (T-543) per ADR-013 §D5.

## Relationship to the prior five launch packs

Frontier Effects is the **sixth + last** first-party launch pack;
News Pro (T-506 skeleton → T-510 GA, v0.2.0), Sports Networks (T-511
skeleton → T-515 GA, v0.2.0), Creator Style (T-516 skeleton → T-520
GA, v0.2.0), Earnings & Investor (T-521 skeleton → T-525 GA,
v0.2.0), and Wedding & Events (T-526 skeleton → T-530 GA, v0.2.0)
precede it. The six packs share:

- the same `paid-per-tenant` commercial-subscription license tier
  (ADR-013 §D3);
- the same pack-source layout + `scripts/build-pack.ts` signing
  pipeline;
- the same DEV-ONLY keypair-rotation-at-marketplace-launch policy.

They differ in:

- the clusters they extend (News Pro → `cluster-a`, Sports Networks →
  `cluster-b`, Creator Style → `cluster-f`, Earnings & Investor →
  vertical `cluster-finance`, Wedding & Events → vertical
  `cluster-wedding-events`, Frontier Effects → existing
  runtime-feature `cluster-i`);
- the content shape (News Pro / Sports Networks / Creator Style:
  per-brand register variants. Earnings & Investor / Wedding &
  Events: vertical-use-case templates. Frontier Effects:
  runtime-feature-extension premium presets — shaders, 3D assets,
  particle physics, TitleSequence templates);
- the SKU pricing (each tier negotiated independently per ADR-013).

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (manifest + signing
  contract this pack implements).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers (the
  catalogue this pack joins as the sixth + last row).
