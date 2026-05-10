---
'@stageflip/parity-cli': patch
---

T-347d — preset `doppler-dbz-standard` substantive (second weatherMap consumer; Cluster C 2/6).

Wires the second `weatherMap`-clipKind preset via `PRESET_ID_BINDINGS` override (Pattern C — clipKind-default arm taken by T-347c `bbcMarkAllenCloudsBinding`). NEXRAD reflectivity dBZ palette (universal `DOPPLER_DBZ_REFLECTIVITY` 7-step canon — do NOT rebrand per cluster SKILL "Color palettes are standard, not brand").

- 8 dBZ-region overlays positioned across the radar image (15 / 20 / 25 / 35 / 40 / 50 / 60 dBZ + Atlanta GA timestamp)
- 8 nested polygon mapPaths in canonical NEXRAD palette: outer light blue (15 dBZ drizzle) → bright green (25) → dark green (35) → yellow (45) → orange (50) → red (60) → magenta hail core
- `productMode: 'reflectivity'` register; `'velocity'` alternative deferred to T-347d-velocity follow-up
- `sweepBeamPhase: 0.25` pins the sweep beam at clockwise quarter-turn (3 o'clock)
- `loopFrameIndex: 0` (start of conceptual loop; multi-frame radar loop deferred to T-347a-loop-cycle)
- Open Sans Regular 14pt OFL
- Top-left legend showing 7-step NEXRAD palette swatches
- Frame 60 single-frame static; PSNR ≥ 40 / SSIM ≥ 0.97 tighter cluster-radar thresholds (radar pixels deterministic per stub line 50)

Verifies §13 (F-30) `'doppler-radar'` style branch end-to-end via parity-fixture + PO visual ratification.

Synthetic geometry adequate-fidelity for parity-fixture verification. Real NEXRAD consumers wire live radar-tile data via T-347a-loop-cycle / T-347b-live-data (LiveDataClip integration; Track A frontier per ADR-005).

Cluster C: 1/6 → 2/6 ELIGIBLE.
