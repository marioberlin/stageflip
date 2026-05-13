---
'@stageflip/pack-finance': minor
---

T-521 — New `@stageflip/pack-finance` content package: the fourth
first-party launch pack and the first to declare a vertical-use-case
cluster (`cluster-finance`) rather than reusing one of the existing
alphabetic clusters. Pack-source skeleton (`packs/`), reproducible
`scripts/build-pack.ts` that synthesizes + signs the deterministic
SFPACK1 archive and emits `archive.sfpack` + `signature.bin` + the
integrity-patched `manifest.json` to `packs/stageflip/finance/0.1.0/`,
and four placeholder finance-vertical presets
(`earnings-call-template-placeholder`,
`investor-deck-template-placeholder`,
`bloomberg-pro-adapter-placeholder`,
`finance-semantic-tools-placeholder`) reserved for T-522 / T-523 /
T-524 / T-525 to fill in. Ships under the commercial-subscription
`paid-per-tenant` license tier per ADR-013 §D3 (SKU `finance-1y`).
The build-pack CLI's default outDir is derived from
`MANIFEST_SKELETON.version` from day one (carrying the T-510 news-pro
bug-fix forward). T-522..T-525 fill the placeholders and bump the
pack toward GA.
