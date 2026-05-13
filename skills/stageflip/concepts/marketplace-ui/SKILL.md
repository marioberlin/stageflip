---
title: Marketplace UI
id: skills/stageflip/concepts/marketplace-ui
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-538
related:
  - skills/stageflip/concepts/marketplace-registry/SKILL.md
  - skills/stageflip/concepts/marketplace-stripe/SKILL.md
  - skills/stageflip/concepts/bundles/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Marketplace UI

The marketplace UI is the customer-facing browse / search surface
for first-party StageFlip packs. T-538 lands it as a **static
subsection of the docs site** at `apps/docs/` — there is no
backend, no server-side rendering, and no live API call. Catalogue
pages are generated at prebuild time from on-disk pack manifests
and served as plain Starlight markdown.

This is the "shop window" only. The "till" — paid checkout — runs
through `@stageflip/marketplace-stripe` (T-537) and the registry's
publish / fetch APIs through `@stageflip/marketplace-registry`
(T-536). T-550 wires both into a deployable host.

## Surface

- `apps/docs/scripts/build-marketplace-pages.ts` — prebuild walker.
  Scans `packs/<publisher>/<id>/<version>/manifest.json`, picks the
  highest version per `(publisher.id, id)`, and emits:
  - `apps/docs/src/content/docs/marketplace/index.md` (catalogue)
  - `apps/docs/src/content/docs/marketplace/<id>/index.md` (per-pack)
  - `apps/docs/src/generated/marketplace-sidebar.json` (consumed by
    `astro.config.mjs`)
- `apps/docs/src/lib/marketplace.ts` — pure renderers + helpers
  (`renderCatalogueIndex`, `renderPackDetail`, `buildMarketplaceSidebar`,
  `pickHighestVersionPerPack`, `compareSemver`, `licenseTierLabel`,
  `groupPresetsByCluster`, `summarizeContributes`). All deterministic
  + side-effect-free — the script wraps them with the I/O layer.
- `apps/docs/astro.config.mjs` reads the sidebar JSON and merges
  the `Marketplace` group ahead of the skills tree.

## Walk + render contract

```
packs/<publisher>/<id>/<version>/manifest.json
            │
            ▼
   parsePackManifest()          ← @stageflip/pack-format, T-494
            │
            ▼
   pickHighestVersionPerPack()  ← highest version wins per (pub, id)
            │
            ├── renderCatalogueIndex(manifests)         → marketplace/index.md
            ├── renderPackDetail(manifest) × N          → marketplace/<id>/index.md
            └── buildMarketplaceSidebar(manifests)      → marketplace-sidebar.json
```

Malformed manifests log a warning and are skipped — they MUST NOT
block the docs build. The catalogue index groups packs by license
tier (paid-per-tenant / enterprise / open) and lists them
alphabetically by id within each group. Per-pack detail pages
render id, version, publisher, license tier + SKU, platform
compatibility, description, keywords, homepage / repository, a
`contributes` summary, presets grouped by cluster, and an `Install`
code snippet (`stageflip-pack install <id>@<version>` — the CLI
ships in T-497).

## What it is NOT

- **No backend.** Static markdown only. The `Install` snippet is a
  copy-paste hint, not a live "buy now" button — checkout lives
  inside the StageFlip app where the user is already authenticated.
- **No client JS.** No React, no Vue, no Stimulus. Starlight
  defaults only. Filter / search is a future enhancement; the
  current surface is server-rendered + scrollable.
- **No live registry call.** The build reads from `packs/` on disk,
  not from `marketplace.stageflip.dev`. Replacing this with a live
  fetch is gated on the registry GA spec (T-550) and is explicitly
  out of scope for the launch.

## Determinism perimeter

`apps/docs/**` is a static-site app — OUTSIDE the determinism
perimeter per CLAUDE.md §3. The prebuild script reads
`packs/**/manifest.json` from the workspace, which means the
deterministic boundary for the marketplace UI is the manifest tree
itself, not the renderer code.

## Forward references

- T-497 ships the `stageflip pack install / list / info` CLI — the
  install snippet on detail pages becomes runnable then.
- T-543 (entitlement / tier-system writer) and T-550 (marketplace
  registry GA) wire purchases through to install-time gating; the
  marketplace UI exposes the catalogue but does NOT itself enforce
  entitlement.
