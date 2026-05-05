---
'@stageflip/parity-cli': patch
---

T-355 — wire `fullScreen → magic-wall-panel` resolver entry + export
`MAGIC_WALL_CANONICAL_REGIONS` constant.

First `fullScreen`-clipKind entry in `DEFAULT_CLIP_KIND_RESOLVER`,
binding to the `magic-wall-panel` primitive shipped by T-355a. The
binding mounts the primitive directly with the canonical 8-region
electoral snapshot inlined as props — `LiveDataClip`'s wrapper is
bypassed for parity per ADR-003 §D2 (D-T355-12; same posture as T-356
D-T356-11 + T-357 D-T357-12). The snapshot mixes all four party-color
paths (3 Dem + 3 Rep + 1 tied + 1 undecided) over a 4×2 placeholder-
rectangle grid sized for the 1280×720 default composition; real US
state SVG path geometry is deferred per D-T355-6.

Closes Cluster E (`data`) to 6/6 substantive + signed presets,
unlocking T-380 batch-merge eligibility. Backward-compatible — the
existing `bigNumber` / `scoreBug` / `newsTicker` / `standings` /
`caption` clipKind branches and the `PRESET_ID_BINDINGS` per-preset
override path are unchanged.
