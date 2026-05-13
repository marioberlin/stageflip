---
'@stageflip/pack-sports-networks': minor
---

T-511 — New `@stageflip/pack-sports-networks` content package: the
second first-party launch pack. Pack-source skeleton (`packs/`),
reproducible `scripts/build-pack.ts` that synthesizes + signs the
deterministic SFPACK1 archive and emits `archive.sfpack` +
`signature.bin` + the integrity-patched `manifest.json` to
`packs/stageflip/sports-networks/0.1.0/`, and four placeholder
cluster-B presets (`nba-pro-register-placeholder`,
`nfl-pro-register-placeholder`, `mlb-register-placeholder`,
`f1-pro-register-placeholder`) reserved for T-512 / T-513 / T-514 /
T-515 to fill in. Ships under the commercial-subscription
`paid-per-tenant` license tier per ADR-013 §D3 (SKU
`sports-networks-1y`). The build-pack CLI's default outDir is derived
from `MANIFEST_SKELETON.version` from day one (carrying the T-510
news-pro bug-fix forward). T-512..T-515 fill the registers and bump
the pack to v0.2.0 GA.
