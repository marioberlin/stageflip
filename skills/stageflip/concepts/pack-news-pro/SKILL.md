---
title: News Pro Pack
id: skills/stageflip/concepts/pack-news-pro
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-506
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
  - skills/stageflip/concepts/pack-trial/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/presets/SKILL.md
---

# News Pro Pack

`@stageflip/pack-news-pro` is StageFlip's **first first-party launch
pack** — a commercial-subscription content bundle extending Cluster A
(news / broadcast templates) with three register variants for the
major European broadcasters plus a premium animated news-ticker
preset. It is shipped under the `paid-per-tenant` license tier per
ADR-013 §D3 with SKU `news-pro-1y`.

The pack does NOT ship clip code. The Cluster A clip kinds it consumes
(`news-ticker`, `lower-third`, `breaking-banner`) all live in the
engine since Phase 13. The pack contributes presets only — declarative
markdown bodies the engine compiles into RIR at clip-mount time.

## The five-task arc

| Task | Ships |
|---|---|
| **T-506** (this skeleton) | Pack-source dir + `scripts/build-pack.ts` + three placeholder presets + LICENSE/NOTICE + npm shim |
| T-507 | Sky News register — fills in `sky-news-register-placeholder.md` |
| T-508 | ITV register — fills in `itv-register-placeholder.md` |
| T-509 | RAI register — fills in `rai-register-placeholder.md` |
| T-510 | Premium news-ticker preset (animated; pack's flagship) |

After T-510 the pack flips from skeleton (placeholder presets) to
consumer-ready (signed archive matches `check-pack-integrity` gate
expectations + presets render observable output per §13).

## What's in the pack-source dir

```
packages/pack-news-pro/packs/
  presets/
    sky-news-register-placeholder.md     (T-506; T-507 fills in)
    itv-register-placeholder.md          (T-506; T-508 fills in)
    rai-register-placeholder.md          (T-506; T-509 fills in)
  LICENSE.md                             (commercial-subscription template)
  NOTICE.md                              (commercial-subscription template)
```

The build script (`scripts/build-pack.ts`) walks this directory,
synthesizes a deterministic SFPACK1 archive (per
`@stageflip/pack-signing/archive`), signs it with the dev Ed25519
private key, computes the SHA-256 integrity hash, and emits the final
trio of files to `packs/stageflip/news-pro/0.1.0/`:

- `archive.sfpack` — signed archive bytes.
- `signature.bin` — 64-byte detached Ed25519 signature.
- `manifest.json` — manifest with `integrity.hash` patched to match.

## The npm shim (`@stageflip/pack-news-pro`)

The `packages/pack-news-pro/` directory is a private workspace package
(it is **not** published to npm; never will be). It exists so:

1. The editor surface can `import { MANIFEST_SKELETON } from
   '@stageflip/pack-news-pro'` and typecheck against the pack
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
  "id": "news-pro",
  "name": "News Pro",
  "version": "0.1.0",
  "publisher": { "id": "stageflip", "displayName": "StageFlip" },
  "platformCompatibility": "^2.0.0",
  "license": {
    "kind": "paid-per-tenant",
    "sku": "news-pro-1y",
    "entitlementType": "subscription"
  },
  "integrity": { "algorithm": "sha256", "hash": "<computed by build-pack>" },
  "contributes": {
    "presets": [
      { "id": "sky-news-register-placeholder", "cluster": "cluster-a" },
      { "id": "itv-register-placeholder",      "cluster": "cluster-a" },
      { "id": "rai-register-placeholder",      "cluster": "cluster-a" }
    ]
  }
}
```

The integrity hash is intentionally a zeros-placeholder in the TS
skeleton (`MANIFEST_SKELETON` in `src/manifest.ts`); the build script
substitutes the real SHA-256 over the archive bytes (excluding the
manifest itself) at sign time.

## Determinism perimeter

`@stageflip/pack-news-pro` lives **OUTSIDE** the determinism perimeter
per CLAUDE.md §3: it's a content package + host-side tooling. The
preset markdown bodies are declarative — no code runs from this
package at clip-render time. The build script is publisher-side
tooling and uses `Date`-free crypto primitives.

## The dev keypair

`keys/news-pro-dev.{public,private}.pem` is a **DEVELOPMENT keypair**
committed into the repo for local + CI signing roundtrip. It is NOT
the production publisher key. The loader's trusted-publisher pin per
tenant means the dev key cannot sign packs admitted into any
production tenant. The dev key is rotated at marketplace launch
(T-543) per ADR-013 §D5.

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (manifest + signing
  contract this pack implements).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers (§D3
  commercial-subscription tier; News Pro is the catalogue's first
  entry).
- **`@stageflip/pack-format`** — `parsePackManifest` validates this
  pack's manifest at load time.
- **`@stageflip/pack-signing`** — `synthesizeArchive` + `signPackArchive`
  primitives the build script composes.
- **`@stageflip/pack-loader`** — gates the signed archive against the
  tenant's trusted-publisher pin.
- **`@stageflip/pack-discovery`** — surfaces the pack in the editor's
  catalogue + recommends it by cluster overlap.
- **`docs/launch-packs-catalogue.md`** — the row-level inventory of
  first-party launch packs; News Pro is the first row.
