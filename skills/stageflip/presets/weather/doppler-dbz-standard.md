---
id: doppler-dbz-standard
cluster: weather
clipKind: weatherMap
source: docs/compass_artifact.md#doppler-radar
status: stub
preferredFont:
  family: Open Sans
  license: ofl
fallbackFont:
  family: Open Sans
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Doppler dBZ Standard — radar register

## Visual tokens
- Standard reflectivity color table on the dBZ scale (universal — DO NOT re-theme):
  - Light precipitation: `#00BFFF` (light blue / teal)
  - Light-to-moderate rain: `#00FF00` → `#009900` (green)
  - Moderate-to-heavy: `#FFFF00` (yellow) → `#FFA500` (orange)
  - Severe / hail: `#FF0000` (red) → `#FF00FF` (magenta)
- Velocity products: `#00FF00` (inbound) and `#FF0000` (outbound). Bright green adjacent to bright red signals rotation (mesocyclone / tornado) — preserve this in any recoloring.
- Sweep beam visualization: thin radial line rotating clockwise

## Typography
- dBZ legend: Regular, 14–16 pt, tabular
- Time-stamp: Regular, 12–14 pt
- Location labels: Regular, 14–18 pt

## Animation
- Volume scans complete every 4–6 minutes (real, when fed live)
- Radar loop: 6–12 frames over 30–90 minutes, ~0.5–1 s per frame
- Sweep animation: clockwise beam rotation, ~3 s per full sweep, with new data populated as the beam passes
- Hook echoes (tornado-rotation indicator): no special highlighting — the canon palette already signals it; do not over-mark

## Rules
- The dBZ palette is universally literate; almost no other data viz is. Do not re-theme even for brand consistency.
- Hook-echo detection on Doppler is life-saving. Render with high enough fidelity that a meteorologist can identify rotation. Don't apply lossy compression to the radar layer.
- Pair with cluster A breaking-news preset when severe-weather warnings are active; the radar alone is informational, not call-to-action.
- Velocity vs. reflectivity products are different registers — `productMode: reflectivity | velocity` declared on compose.

## Acceptance (parity)
- Reference frames: 0 (frame N of loop), 12 (frame N+1), 24 (frame N+2), 60 (loop restart)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Doppler radar
- NWS / NEXRAD canon
- Frontier: `LiveDataClip` (NEXRAD feed) for live register
- ADR-004
