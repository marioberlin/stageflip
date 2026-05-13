---
'@stageflip/pack-creator-style': minor
---

T-516 — New `@stageflip/pack-creator-style` content package: the
third first-party launch pack. Pack-source skeleton (`packs/`),
reproducible `scripts/build-pack.ts` that synthesizes + signs the
deterministic SFPACK1 archive and emits `archive.sfpack` +
`signature.bin` + the integrity-patched `manifest.json` to
`packs/stageflip/creator-style/0.1.0/`, and four placeholder
cluster-F presets (`mkbhd-pro-register-placeholder`,
`vox-deluxe-register-placeholder`,
`linus-tech-tips-pro-register-placeholder`,
`prestige-creator-placeholder`) reserved for T-517 / T-518 / T-519 /
T-520 to fill in. Ships under the commercial-subscription
`paid-per-tenant` license tier per ADR-013 §D3 (SKU
`creator-style-1y`). The build-pack CLI's default outDir is derived
from `MANIFEST_SKELETON.version` from day one (carrying the T-510
news-pro bug-fix forward). T-517..T-520 fill the presets and bump
the pack toward GA.
