---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-347a — `weatherMap` runtime-clip primitive (Cluster C first-of-two new primitives).

Sealed three-style sealed-bundle compositor:

- `'mark-allen-clouds'` — BBC 1975 Mark-Allen icon set (cloud / sun / raindrop / snow) + temperature discs from canonical 6-step blue→red palette.
- `'doppler-radar'` — NEXRAD reflectivity dBZ palette (universal canon) + optional clockwise sweep beam + `productMode: 'reflectivity' | 'velocity'` with mesocyclone-signature-preserving green/red velocity branch.
- `'heat-map'` — Esri/NWS Meriam 38-class temperature gradient (deep-purple-sub-zero → dark-maroon-extreme-heat) + optional Meriam light-dark oscillation across classes for color-blind viewers + `units: 'F' | 'C'`.

Single primitive, `discriminatedUnion('style', [...])`, canonical palettes baked as static module-level constants (NOT theme-able per cluster SKILL "Color palettes are standard, not brand"). Mirrors T-321 titleSequence's 4-style architecture.

Exported helpers for parity-cli resolver-shims: `MARK_ALLEN_TEMPERATURE_DISCS`, `DOPPLER_DBZ_REFLECTIVITY`, `DOPPLER_VELOCITY`, `MERIAM_38_CLASS_HEAT`, `resolveMarkAllenDisc`, `resolveHeatMapFill`, `resolveDopplerPalette`.

`ALL_BRIDGE_CLIPS` length: 58 → 59. Frame-deterministic; theme slots `background` + `foreground` (palettes themselves NOT theme-bound).

v1 carve-outs deferred:

- 3D rotating globe (BBC) → T-347a-3d-globe (Track A frontier; `ThreeSceneClip` per ADR-005).
- Multi-frame radar loop cycling → T-347a-loop-cycle.
- Heat-map time-period cycling → T-347a-time-lapse.

Unblocks 3 of 6 Cluster C presets: `bbc-mark-allen-clouds`, `doppler-dbz-standard`, `heat-map-cool-to-warm`. Per CLAUDE.md §13 verification posture: deferral to consumer presets — first-render verification for each style branch happens in the FIRST consumer preset's impl PR.
