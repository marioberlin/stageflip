---
'@stageflip/pack-loader': minor
'@stageflip/pack-cli': minor
---

T-540 — Pack upgrade planner + `stageflip-pack upgrade --target <ver>`
CLI subcommand. Walks installed packs, evaluates per-pack
platformCompatibility against the target engine version via T-502's
COMPATIBILITY_MATRIX, and produces a recommended action per pack.
