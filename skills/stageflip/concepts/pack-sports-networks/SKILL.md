---
title: Sports Networks Pack
id: skills/stageflip/concepts/pack-sports-networks
tier: concept
status: placeholder
last_updated: 2026-05-13
owner_task: T-511
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
  - skills/stageflip/concepts/pack-trial/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/pack-news-pro/SKILL.md
  - skills/stageflip/concepts/presets/SKILL.md
---

# Sports Networks Pack

`@stageflip/pack-sports-networks` is StageFlip's **second first-party
launch pack** — a commercial-subscription content bundle extending
Cluster B (sports-broadcast templates) with four register variants for
the major sports leagues plus an AR formations bundle. It is shipped
under the `paid-per-tenant` license tier per ADR-013 §D3 with SKU
`sports-networks-1y`.

The pack does NOT ship clip code. The Cluster B clip kinds it consumes
(`lower-third`, `scoreBug`, `arOverlay`, etc.) all live in the engine
since Phase 13. The pack contributes presets only — declarative
markdown bodies the engine compiles into RIR at clip-mount time.

## The five-task arc

| Task | Ships |
|---|---|
| **T-511** (this skeleton) | Pack-source dir + `scripts/build-pack.ts` + four placeholder presets + LICENSE/NOTICE + npm shim |
| T-512 | NBA Pro register — fills in `nba-pro-register-placeholder.md` |
| T-513 | NFL Pro register — fills in `nfl-pro-register-placeholder.md` |
| T-514 | MLB register — fills in `mlb-register-placeholder.md` |
| T-515 | F1 Pro register + AR formations bundle (pack's flagship) — fills in `f1-pro-register-placeholder.md` |

After T-515 the pack flips from skeleton (placeholder presets) to
consumer-ready (signed archive matches `check-pack-integrity` gate
expectations + presets render observable output per CLAUDE.md §13).

## What's in the pack-source dir

```
packages/pack-sports-networks/packs/
  presets/
    nba-pro-register-placeholder.md   (T-511; T-512 fills in)
    nfl-pro-register-placeholder.md   (T-511; T-513 fills in)
    mlb-register-placeholder.md       (T-511; T-514 fills in)
    f1-pro-register-placeholder.md    (T-511; T-515 fills in + AR bundle)
  LICENSE.md                          (commercial-subscription template)
  NOTICE.md                           (commercial-subscription template)
```

The build script (`scripts/build-pack.ts`) walks this directory,
synthesizes a deterministic SFPACK1 archive (per
`@stageflip/pack-signing/archive`), signs it with the dev Ed25519
private key, computes the SHA-256 integrity hash, and emits the final
trio of files to `packs/stageflip/sports-networks/0.1.0/`:

- `archive.sfpack` — signed archive bytes.
- `signature.bin` — 64-byte detached Ed25519 signature.
- `manifest.json` — manifest with `integrity.hash` patched to match.

## The npm shim (`@stageflip/pack-sports-networks`)

The `packages/pack-sports-networks/` directory is a private workspace
package (it is **not** published to npm; never will be). It exists so:

1. The editor surface can `import { MANIFEST_SKELETON } from
   '@stageflip/pack-sports-networks'` and typecheck against the pack
   metadata.
2. The `scripts/build-pack.ts` build script lives next to the manifest
   source-of-truth so the signing pipeline is auditable +
   reproducible.
3. The pack-source dir + dev keys live in a workspace package so they
   are versioned + reviewed alongside the rest of the codebase, not as
   loose files under a `packs/` top-level root.

## Manifest highlights

```jsonc
{
  "manifestVersion": "1",
  "id": "sports-networks",
  "name": "Sports Networks",
  "version": "0.1.0",
  "publisher": { "id": "stageflip", "displayName": "StageFlip" },
  "platformCompatibility": "^2.0.0",
  "license": {
    "kind": "paid-per-tenant",
    "sku": "sports-networks-1y",
    "entitlementType": "subscription"
  },
  "integrity": { "algorithm": "sha256", "hash": "<computed by build-pack>" },
  "contributes": {
    "presets": [
      { "id": "nba-pro-register-placeholder", "cluster": "cluster-b" },
      { "id": "nfl-pro-register-placeholder", "cluster": "cluster-b" },
      { "id": "mlb-register-placeholder",     "cluster": "cluster-b" },
      { "id": "f1-pro-register-placeholder",  "cluster": "cluster-b" }
    ]
  }
}
```

The integrity hash is intentionally a zeros-placeholder in the TS
skeleton (`MANIFEST_SKELETON` in `src/manifest.ts`); the build script
substitutes the real SHA-256 over the archive bytes (excluding the
manifest itself) at sign time.

## Determinism perimeter

`@stageflip/pack-sports-networks` lives **OUTSIDE** the determinism
perimeter per CLAUDE.md §3: it's a content package + host-side tooling.
The preset markdown bodies are declarative — no code runs from this
package at clip-render time. The build script is publisher-side
tooling and uses `Date`-free crypto primitives.

## The dev keypair

`keys/sports-networks-dev.{public,private}.pem` is a **DEVELOPMENT
keypair** committed into the repo for local + CI signing roundtrip. It
is NOT the production publisher key. The loader's trusted-publisher
pin per tenant means the dev key cannot sign packs admitted into any
production tenant. The dev key is rotated at marketplace launch
(T-543) per ADR-013 §D5.

## Relationship to News Pro

Sports Networks is the **second** first-party launch pack; News Pro
(T-506 skeleton → T-510 GA, v0.2.0) is the first. The two packs share:

- the same `paid-per-tenant` commercial-subscription license tier
  (ADR-013 §D3);
- the same pack-source layout + `scripts/build-pack.ts` signing
  pipeline;
- the same DEV-ONLY keypair-rotation-at-marketplace-launch policy.

They differ in:

- the clusters they extend (News Pro → Cluster A, Sports Networks →
  Cluster B);
- the register lineup (News Pro: 3 European broadcaster lower-thirds +
  premium news-ticker; Sports Networks: 4 league registers + AR
  formations bundle);
- the SKU pricing (each tier negotiated independently per ADR-013).

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (manifest + signing
  contract this pack implements).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers (§D3
  commercial-subscription tier).
- **`@stageflip/pack-format`** — `parsePackManifest` validates this
  pack's manifest at load time.
- **`@stageflip/pack-signing`** — `synthesizeArchive` + `signPackArchive`
  primitives the build script composes.
- **`@stageflip/pack-loader`** — gates the signed archive against the
  tenant's trusted-publisher pin.
- **`@stageflip/pack-discovery`** — surfaces the pack in the editor's
  catalogue + recommends it by cluster overlap.
- **`@stageflip/pack-news-pro`** — sibling first-party launch pack;
  same template + signing pipeline.
- **`docs/launch-packs-catalogue.md`** — the row-level inventory of
  first-party launch packs; Sports Networks is the second row.
