---
'@stageflip/app-docs': minor
---

T-538 — Marketplace pack browsing / search UI in `apps/docs`
(P16 δ third task). Lands the static marketplace surface inside the
Astro Starlight docs site at `/marketplace/` (catalogue index) plus
per-pack detail pages at `/marketplace/<pack-id>/`. A new prebuild
walker (`scripts/build-marketplace-pages.ts`) scans
`packs/<publisher>/<id>/<version>/manifest.json`, picks the highest
version per (publisher, id) using `parsePackManifest` from
`@stageflip/pack-format` for type-safe parsing, and emits Astro
content-collection markdown files plus a sidebar manifest
(`src/generated/marketplace-sidebar.json`) consumed by
`astro.config.mjs`. Pure renderers + sidebar builder live in
`src/lib/marketplace.ts` and ship `compareSemver`,
`pickHighestVersionPerPack`, `groupPresetsByCluster`,
`summarizeContributes`, `renderCatalogueIndex`, `renderPackDetail`,
and `buildMarketplaceSidebar`. The catalogue groups packs by license
tier (paid-per-tenant / enterprise / open) and lists them
alphabetically by id; per-pack pages render id, version, publisher,
license tier + SKU, platform compatibility, description, keywords,
homepage / repository, presets grouped by cluster, contribute-count
summary, and the install snippet
(`stageflip-pack install <id>@<version>`, forward-referencing
T-497). All six launch packs (news-pro, sports-networks,
creator-style, finance, wedding-events, frontier-fx) render via the
walker. Static-site only: no SSR, no client JS, no React. New skill
`skills/stageflip/concepts/marketplace-ui/SKILL.md` documents the
surface. No new external npm deps — the build script reuses
`@stageflip/pack-format` via the existing workspace.
