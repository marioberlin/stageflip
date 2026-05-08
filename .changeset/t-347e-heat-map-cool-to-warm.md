---
'@stageflip/parity-cli': patch
---

T-347e — preset `heat-map-cool-to-warm` substantive (third + final weatherMap consumer; Cluster C 3/6).

Wires the third + final `weatherMap`-clipKind preset via `PRESET_ID_BINDINGS` override (Pattern C). Esri/NWS Meriam 38-class temperature gradient `MERIAM_38_CLASS_HEAT` (deep-purple-sub-zero → dark-maroon-extreme-heat); `units: 'F'` (US-domestic); `oscillation: true` (Meriam light-dark across classes for color-blind differentiation per stub line 47).

After T-347e + T-347c + T-347d ship, **all three weatherMap §13 obligations are closed** (`'mark-allen-clouds'` / `'doppler-radar'` / `'heat-map'` style branches each independently verified end-to-end via parity-fixture + PO ratification).

- 8 US regions spanning the canonical Meriam spectrum: Anchorage 18°F (paletteIndex 4 blue) → Minneapolis 38°F (6) → Seattle 52°F (11 green) → Denver 65°F (14 yellow-green) → Atlanta 78°F (18 yellow) → LA 85°F (20 orange) → Phoenix 102°F (26 red) → Death Valley 118°F (32 dark maroon)
- 8 mapPaths with `id` matching `regions[].id`; `fill` deliberately omitted — primitive's heat-map style branch derives fill from `region.paletteIndex` via `resolveHeatMapFill(paletteIndex, oscillation)` (D-T347a-7 pattern)
- `oscillation: true` enables Meriam light-dark across classes
- Open Sans Bold 18pt OFL; bottom-right legend with °F suffix
- Light grey `#E8E8E8` muted base for non-data regions per stub line 32
- Frame 60 single-frame static; PSNR ≥ 40 / SSIM ≥ 0.97 cluster-radar tighter thresholds (gradient deterministic per stub line 50)

Multi-frame heat-map time-period cycling deferred to T-347a-time-lapse. Optional `units: 'C'` parity-register variant deferred to T-347e-celsius.

Cluster C: 2/6 → 3/6 ELIGIBLE (after T-347c, T-347d, T-347e all merge).
