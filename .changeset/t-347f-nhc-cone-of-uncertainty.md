---
'@stageflip/parity-cli': patch
---

T-347f — preset `nhc-cone-of-uncertainty` substantive (only stormTracker consumer; Cluster C 4/6).

Wires the only `stormTracker`-clipKind preset via `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first preset for a clipKind goes through the clipKind-default arm). Synthetic Atlantic hurricane "MARGOT" with canonical NHC 5-day cone + 6 forecast track dots (D→S→H→M intensity arc per NWS mandate) + 3 coastal warnings demonstrating the sealed `warningType` enum dispatch.

**Mandatory disclaimer verified**: the rendered golden shows "Impacts extend beyond the cone" centered at the bottom — the primitive's safety contract per D-T347b-2 (caller cannot suppress; the cone-of-uncertainty misinterpretation is a documented public-safety failure mode).

- Storm: `HURRICANE MARGOT`, advisory 18 — 5 PM EDT Mon
- 6 track dots: 0h (H), 24h (H), 48h (M), 72h (M), 96h (H), 120h (S) — full canonical D→S→H→M→H→S arc
- Cone polygon widening from ∼20px (current) to ∼160px (120h)
- 3 coastal warnings: Florida `hurricane-warning` (Crimson #DC143C), Georgia/SC `storm-surge-warning` (Dark Purple #B524F7), North Carolina `hurricane-watch` (Magenta #FF00FF)
- 2 mapPaths: SE US coastline + Bahamas/Caribbean strip
- Open Sans Bold 32pt OFL for storm-name banner
- Frame 60 single-frame static; PSNR ≥ 38 / SSIM ≥ 0.95 cluster-norm thresholds

§13 (F-30) verification: this PR's parity-golden + PO ratification verifies the stormTracker primitive's single-style v1 surface end-to-end (cone polygon, track-dot intensity letters, coastal-warning palette dispatch, mandatory disclaimer, storm-name banner). Single consumer → single PO ratification closes the §13 obligation.

Multi-advisory animated time-lapse deferred to T-347b-advisory-cycle. LiveDataClip integration deferred to T-347b-live-data (Track A frontier per ADR-005). 2026 NHC inland-warnings update deferred to T-347b-2026-inland-warnings.

Cluster C: 3/6 → 4/6 ELIGIBLE (after T-347c+d+e+f all merge).
