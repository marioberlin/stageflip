---
title: Earnings & Investor Pack
id: skills/stageflip/concepts/pack-finance
tier: concept
status: placeholder
last_updated: 2026-05-13
owner_task: T-521
related:
  - skills/stageflip/concepts/licensing/SKILL.md
  - skills/stageflip/concepts/pack-discovery/SKILL.md
  - skills/stageflip/concepts/pack-trial/SKILL.md
  - skills/stageflip/concepts/pack-telemetry/SKILL.md
  - skills/stageflip/concepts/pack-news-pro/SKILL.md
  - skills/stageflip/concepts/pack-sports-networks/SKILL.md
  - skills/stageflip/concepts/pack-creator-style/SKILL.md
  - skills/stageflip/concepts/presets/SKILL.md
---

# Earnings & Investor Pack

`@stageflip/pack-finance` is StageFlip's **fourth first-party launch
pack** — a commercial-subscription content bundle declaring a NEW
finance-vertical cluster (`cluster-finance`) with vertical-use-case
composition templates for financial communications, a premium
adapter tier for Bloomberg-style market data, and finance-domain
semantic-tool extensions. It is shipped under the `paid-per-tenant`
license tier per ADR-013 §D3 with SKU `finance-1y`.

The pack does NOT ship clip code. The Cluster F lower-third clip kind
and any other underlying clip kinds the composition templates consume
live in the engine since Phase 13. The pack contributes presets only —
declarative markdown bodies the engine compiles into RIR at clip-mount
time.

## What makes this pack different

News Pro (T-506..T-510), Sports Networks (T-511..T-515), and Creator
Style (T-516..T-520) all contribute **per-brand registers** within
existing alphabetic clusters (cluster-a / cluster-b / cluster-f).
Earnings & Investor breaks that pattern in two ways:

1. **Vertical-use-case cluster.** The four placeholders declare the
   new `cluster-finance` cluster — a vertical-use-case discriminant
   rather than an alphabetic one. `cluster` is a free-form string in
   the manifest schema (`packages/pack-format/src/manifest.ts`: `cluster:
   z.string().min(1)`), so declaring a new vertical cluster is purely
   a content-side metadata operation. No clip-code change.
2. **Composition-template content shape.** Rather than three / four
   brand-keyed register variants of the same clip kind, the pack
   contributes two composition templates (earnings-call + investor-
   deck), a premium adapter tier (Bloomberg-pro), and a semantic-tools
   contribution. Each fills a different need than a brand register.

## The five-task arc

| Task | Ships |
|---|---|
| **T-521** (this skeleton) | Pack-source dir + `scripts/build-pack.ts` + four placeholder presets + LICENSE/NOTICE + npm shim |
| T-522 | Earnings-call composition template — fills in `earnings-call-template-placeholder.md` |
| T-523 | Investor-deck composition template — fills in `investor-deck-template-placeholder.md` |
| T-524 | Bloomberg-pro adapter premium tier — fills in `bloomberg-pro-adapter-placeholder.md` |
| T-525 | Finance-domain semantic-tool extensions — fills in `finance-semantic-tools-placeholder.md` |

After T-525 the pack flips from skeleton (placeholder presets) to
consumer-ready (signed archive matches `check-pack-integrity` gate
expectations + presets render observable output per CLAUDE.md §13).

## What's in the pack-source dir

```
packages/pack-finance/packs/
  presets/
    earnings-call-template-placeholder.md    (T-521; T-522 fills in)
    investor-deck-template-placeholder.md    (T-521; T-523 fills in)
    bloomberg-pro-adapter-placeholder.md     (T-521; T-524 fills in)
    finance-semantic-tools-placeholder.md    (T-521; T-525 fills in)
  LICENSE.md                                 (commercial-subscription template)
  NOTICE.md                                  (commercial-subscription template)
```

The build script (`scripts/build-pack.ts`) walks this directory,
synthesizes a deterministic SFPACK1 archive (per
`@stageflip/pack-signing/archive`), signs it with the dev Ed25519
private key, computes the SHA-256 integrity hash, and emits the final
trio of files to `packs/stageflip/finance/0.1.0/`:

- `archive.sfpack` — signed archive bytes.
- `signature.bin` — 64-byte detached Ed25519 signature.
- `manifest.json` — manifest with `integrity.hash` patched to match.

## The npm shim (`@stageflip/pack-finance`)

The `packages/pack-finance/` directory is a private workspace package
(it is **not** published to npm; never will be). It exists so:

1. The editor surface can `import { MANIFEST_SKELETON } from
   '@stageflip/pack-finance'` and typecheck against the pack metadata.
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
  "id": "finance",
  "name": "Earnings & Investor",
  "version": "0.1.0",
  "publisher": { "id": "stageflip", "displayName": "StageFlip" },
  "platformCompatibility": "^2.0.0",
  "license": {
    "kind": "paid-per-tenant",
    "sku": "finance-1y",
    "entitlementType": "subscription"
  },
  "integrity": { "algorithm": "sha256", "hash": "<computed by build-pack>" },
  "contributes": {
    "presets": [
      { "id": "earnings-call-template-placeholder",  "cluster": "cluster-finance" },
      { "id": "investor-deck-template-placeholder",  "cluster": "cluster-finance" },
      { "id": "bloomberg-pro-adapter-placeholder",   "cluster": "cluster-finance" },
      { "id": "finance-semantic-tools-placeholder",  "cluster": "cluster-finance" }
    ]
  }
}
```

The integrity hash is intentionally a zeros-placeholder in the TS
skeleton (`MANIFEST_SKELETON` in `src/manifest.ts`); the build script
substitutes the real SHA-256 over the archive bytes (excluding the
manifest itself) at sign time.

## The `cluster-finance` vertical cluster

`cluster-finance` is the first vertical-use-case cluster declared in a
first-party pack manifest. It is NOT an alphabetic cluster (a/b/c/…/g)
and it is NOT a clipKind discriminant. It is a content-side
metadata label on `contributes.presets[].cluster` that lets the editor
surface and the marketplace group + filter the four finance presets as
a coherent unit.

`check-skill-drift` enforces preset ↔ cluster directory parity by
walking `skills/stageflip/presets/<cluster>/` — it does not maintain
an allowlist of cluster names from pack manifests. No allowlist update
is required for T-521. (T-525 may add a `skills/stageflip/presets/
cluster-finance/SKILL.md` if the finance presets warrant a presets-
tier cluster skill, but that is a T-525 concern, not T-521.)

## Determinism perimeter

`@stageflip/pack-finance` lives **OUTSIDE** the determinism perimeter
per CLAUDE.md §3: it's a content package + host-side tooling. The
preset markdown bodies are declarative — no code runs from this
package at clip-render time. The build script is publisher-side
tooling and uses `Date`-free crypto primitives.

## The dev keypair

`keys/finance-dev.{public,private}.pem` is a **DEVELOPMENT keypair**
committed into the repo for local + CI signing roundtrip. It is NOT
the production publisher key. The loader's trusted-publisher pin per
tenant means the dev key cannot sign packs admitted into any
production tenant. The dev key is rotated at marketplace launch
(T-543) per ADR-013 §D5.

## Relationship to the prior three launch packs

Earnings & Investor is the **fourth** first-party launch pack; News
Pro (T-506 skeleton → T-510 GA, v0.2.0), Sports Networks (T-511
skeleton → T-515 GA, v0.2.0), and Creator Style (T-516 skeleton →
T-520 GA, v0.2.0) precede it. The four packs share:

- the same `paid-per-tenant` commercial-subscription license tier
  (ADR-013 §D3);
- the same pack-source layout + `scripts/build-pack.ts` signing
  pipeline;
- the same DEV-ONLY keypair-rotation-at-marketplace-launch policy.

They differ in:

- the clusters they extend (News Pro → `cluster-a`, Sports Networks →
  `cluster-b`, Creator Style → `cluster-f`, Earnings & Investor →
  the new vertical-use-case `cluster-finance`);
- the content shape (News Pro / Sports Networks / Creator Style: per-
  brand register variants. Earnings & Investor: vertical-use-case
  composition templates + adapter tier + semantic-tools extension);
- the SKU pricing (each tier negotiated independently per ADR-013).

## Cross-references

- **ADR-012** — Bundle Format & License Runtime (manifest + signing
  contract this pack implements).
- **ADR-013** — First-party Pack Catalogue & Pricing Tiers (the
  catalogue this pack joins as the fourth row).
