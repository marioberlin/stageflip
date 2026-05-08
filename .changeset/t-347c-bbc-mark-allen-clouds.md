---
'@stageflip/parity-cli': patch
---

T-347c — preset `bbc-mark-allen-clouds` substantive (first weatherMap consumer; Cluster C 1/6).

Wires the first `weatherMap`-clipKind preset via `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first consumer goes through the clipKind-default arm). Mark Allen 1975 BBC symbol set + temperature discs from canonical 6-step blue→red palette.

- 4 temperature-disc regions across UK cities (London, Edinburgh, Cardiff, Belfast)
- 6 Mark-Allen canonical icons (2 cloud + 1 sun + 2 raindrop + 1 snow)
- 3 SVG mapPaths (Europe + UK/Ireland silhouette + North Sea water gap)
- BBC Reith Sans `proprietary-byo` with Source Sans 3 OFL fallback
- Frame 60 single-frame static; PSNR ≥ 38 / SSIM ≥ 0.95 cluster-norm thresholds

Verifies §13 (F-30) `'mark-allen-clouds'` style branch end-to-end via parity-fixture + PO visual ratification. The other two weatherMap branches (`'doppler-radar'` / `'heat-map'`) verify independently in T-347d / T-347e.

v1 ships flat 2D — 3D rotating globe (Weatherscape canon) deferred to T-347a-3d-globe (Track A frontier; ThreeSceneClip per ADR-005). Multi-frame globe rotation + camera swoop deferred to T-347a-loop-cycle.

Cluster C: 0/6 → 1/6 ELIGIBLE.
