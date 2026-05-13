---
'@stageflip/pack-news-pro': minor
---

T-506 — New `@stageflip/pack-news-pro` content package: pack-source
skeleton (`packs/`), reproducible `scripts/build-pack.ts` that
synthesizes + signs the deterministic SFPACK1 archive and emits
`archive.sfpack` + `signature.bin` + the integrity-patched
`manifest.json` to `packs/stageflip/news-pro/0.1.0/`, and three
placeholder cluster-A presets (`sky-news-register-placeholder`,
`itv-register-placeholder`, `rai-register-placeholder`) reserved for
T-507 / T-508 / T-509 to fill in. Ships under the
commercial-subscription `paid-per-tenant` license tier per ADR-013
§D3 (SKU `news-pro-1y`). T-510 then lands the premium news-ticker
preset and the pack flips from skeleton to consumer-ready.
