---
title: Bundles
id: skills/stageflip/concepts/bundles
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-493
related:
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
---

# Bundles

A **bundle** (also called a "pack" in the marketplace UX) is a
signed, content-addressed archive that ships StageFlip content +
optional clip implementations to a tenant's runtime. Bundles are the
marketplace's distribution unit per ADR-012; the three pricing tiers
(free / paid / enterprise) per ADR-013 share the same format.

## The bundle format

A `.stageflip-pack` file is a deterministic-tar + zstd-compressed
archive containing:

```
.stageflip-pack/
  manifest.json                  // strict per ADR-012 §D2
  signature.bin                  // detached Ed25519 per ADR-012 §D3
  presets/<cluster>/<id>.md      // preset markdown
  clips/<clipKind>/              // optional clip implementations
  fonts/<family>/                // optional font assets
  fixtures/<id>/                 // optional parity-fixture goldens
  assets/<path>                  // arbitrary asset content
```

Pack contents are read-only after sign. The loader verifies signature
+ integrity at install + at every subsequent boot.

## What's in a bundle

A bundle declares its `PackContributions` in `manifest.json`:

- **presets** — markdown files in `skills/stageflip/presets/<cluster>/`
  style; references the cluster's clip family.
- **clipKinds** — net-new clip implementations the runtime registers
  on load (e.g., a custom three-scene variant).
- **fonts** — additional fonts whose licenses the bundle audits and
  whose loaders the editor wires.
- **fixtures** — parity goldens for the bundle's presets.
- **assets** — raster / vector / video / audio assets the presets
  reference.
- **tools** — additional `compose_*` tools the agent surface registers.
- **adapters** — `AudienceBackendProvider` / asset-gen provider
  implementations (e.g., a third-party voice cloning provider).
- **themePacks** — `Theme` declarations + supporting fonts.

Each contribution kind has a CI-time validator that extends the
existing pre-merge gates (check-asset-licenses, check-skill-drift,
check-audience-permissions, etc.).

## License tiers + entitlement

Bundles declare their license in `manifest.license`:

- **`open`** — bundled under a permitted OSS license (MIT / Apache-2.0 /
  CC-BY-4.0 / CC0-1.0). The runtime gate is a no-op.
- **`paid-per-tenant`** — requires the tenant to hold an entitlement
  for the bundle's `sku`. Per-tenant subscription billing per ADR-013
  §D3.
- **`enterprise`** — requires a contract reference; per-contract
  revocation.

The runtime checks entitlements at **two points** per ADR-012 §D6:

1. **Install / load time** — pack-loader refuses to load if the
   tenant lacks entitlement.
2. **Clip-instantiation time** — renderer-core's `findClip` dispatch
   re-checks entitlement; revocation mid-session falls back to
   `staticFallback`.

## Marketplace distribution

Bundles ship via the marketplace at `marketplace.stageflip.dev` per
ADR-014:

```bash
$ stageflip pack install news-pro@1.0.0
# Downloads to ~/.stageflip/packs/stageflip/news-pro/1.0.0/
```

First-party publishers (StageFlip Inc.) sign with bundled-in keys.
Third-party publishers register via TOFU at the marketplace's
publisher-keys endpoint.

## Determinism perimeter

`@stageflip/pack-format` + `@stageflip/pack-loader` live OUTSIDE the
determinism perimeter (per CLAUDE.md §3 — the perimeter is
`packages/runtimes/**`, `packages/frame-runtime/**`,
`packages/renderer-core/src/clips/**`). Loaders use Node-only
primitives (`node:fs`, `node:crypto` for Ed25519).

Packs CAN contribute clip implementations that ARE inside the
determinism perimeter (e.g., a shader pack contributing a `ShaderClip`
variant). The clip's source code is responsible for its own
determinism contract; the pack format imposes no additional
constraints beyond what the existing determinism gates already
enforce.

## Loss flags

Five `LF-LICENSE-*` / `LF-PACK-*` codes per ADR-012 §D10:

| Code | Severity | Trigger |
|---|---|---|
| `LF-LICENSE-PACK-DENIED` | error | Install-time entitlement check failed |
| `LF-LICENSE-CLIP-REVOKED` | warn | Mid-session entitlement revocation |
| `LF-PACK-SIGNATURE-INVALID` | error | Ed25519 verification failed |
| `LF-PACK-INCOMPATIBLE-VERSION` | error | platformCompatibility mismatch |
| `LF-PACK-MANIFEST-PARSE-ERROR` | error | manifest.json rejects by Zod |

Land in `@stageflip/loss-flags` via T-494.

## Plugin manifest extensions

Per ADR-007 §D12 + ADR-012 §D11, bundles participate in the existing
plugin-manifest contribution-kind system. The four new kinds:

- `pack` — generic content pack
- `clip-pack` — clip implementations only
- `adapter-pack` — `AudienceBackendProvider` / asset-gen providers
- `theme-pack` — `Theme` declarations

Plugin ratification at install time validates the contributions
match the declared kind.

## Cross-references

- **ADR-012** Bundle Format & License Runtime — full format spec.
- **ADR-013** First-party Pack Catalogue & Pricing Tiers — the six
  inaugural launch packs + the three-tier structure.
- **ADR-014** Marketplace — hosting + publisher-key distribution +
  install workflow.
- **`@stageflip/pack-format`** (T-494) — Zod manifest schema + signature
  utilities.
- **`@stageflip/pack-loader`** (T-495) — filesystem walker + entitlement
  check + integrity verification.
- **`TenantEntitlementsStore`** (T-496) — per-tenant entitlement storage
  facet.
