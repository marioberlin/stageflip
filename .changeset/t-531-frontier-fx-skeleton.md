---
'@stageflip/pack-frontier-fx': minor
---

T-531 — New `@stageflip/pack-frontier-fx` content package: the
sixth + last first-party launch pack and the first to be
runtime-feature-extension oriented (premium shaders, pre-licensed 3D
asset library, premium ReactionStream particle physics, premium
TitleSequence templates) rather than per-brand-register or
vertical-use-case oriented. Pack-source skeleton (`packs/`),
reproducible `scripts/build-pack.ts` that synthesizes + signs the
deterministic SFPACK1 archive and emits `archive.sfpack` +
`signature.bin` + the integrity-patched `manifest.json` to
`packs/stageflip/frontier-fx/0.1.0/`, and four placeholder
frontier-effects presets (`premium-shaders-placeholder`,
`3d-asset-library-placeholder`,
`reactionstream-physics-placeholder`,
`titlesequence-premium-placeholder`) reserved for T-532 / T-533 /
T-534 / T-535 to fill in. The pack extends the existing `cluster-i`
Live Audience cluster (frontier-runtime work from P15 + Track A).
Ships under the commercial-subscription `paid-per-tenant` license
tier per ADR-013 §D3 (SKU `frontier-fx-1y`). The build-pack CLI's
default outDir is derived from `MANIFEST_SKELETON.version` from day
one (carrying the T-510 news-pro bug-fix forward). T-532..T-535 fill
the placeholders and bump the pack toward GA.
