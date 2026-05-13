---
'@stageflip/pack-wedding-events': minor
---

T-526 — New `@stageflip/pack-wedding-events` content package: the
fifth first-party launch pack and the second to declare a
vertical-use-case cluster (`cluster-wedding-events`) rather than
reusing one of the existing alphabetic clusters. Pack-source skeleton
(`packs/`), reproducible `scripts/build-pack.ts` that synthesizes +
signs the deterministic SFPACK1 archive and emits `archive.sfpack` +
`signature.bin` + the integrity-patched `manifest.json` to
`packs/stageflip/wedding-events/0.1.0/`, and four placeholder
wedding-events-vertical presets (`rustic-theme-placeholder`,
`wedding-composition-templates-placeholder`,
`wedding-transitions-placeholder`, `audio-bed-library-placeholder`)
reserved for T-527 / T-528 / T-529 / T-530 to fill in. Ships under
the commercial-subscription `paid-per-tenant` license tier per
ADR-013 §D3 (SKU `wedding-events-1y`). The build-pack CLI's default
outDir is derived from `MANIFEST_SKELETON.version` from day one
(carrying the T-510 news-pro bug-fix forward). T-527..T-530 fill the
placeholders and bump the pack toward GA.
