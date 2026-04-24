---
id: heat-map-cool-to-warm
cluster: weather
clipKind: weatherMap
source: docs/compass_artifact.md#temperature-heat-maps
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

# Heat Map Cool-to-Warm — temperature register

## Visual tokens
- Gradient color mapping (Esri / NWS canon, designed by Emily Meriam, 38 color classes):
  - Below 0°F: deep purple `#4B0082`
  - Freezing: blues `#0000FF` range
  - Mild: greens `#00FF00`
  - Warm: yellows `#FFFF00`
  - Hot: reds `#FF0000`
  - Extreme heat (100°F+): dark maroon `#800000`
- Light-dark oscillating brightness across classes for differentiation (Meriam canon)
- Map base: muted gray `#E8E8E8` for non-data regions

## Typography
- Temperature labels per region: Bold, 18–22 pt, tabular
- Region labels: Regular, 14–16 pt
- Legend: Regular, 14–16 pt

## Animation
- Time-lapse: maps cycle through forecast periods, 1.5–2 s per period, ease-in-out
- Individual city temperatures count up / down (use cluster E `big-number-stat-impact` for the count behavior)
- Heat-wave coverage: red / maroon zones pulse + expand over successive days, 600 ms per pulse
- Cool-down register: zones contract / shift toward green-blue end of palette

## Rules
- Cool-to-warm palette has near-universal literacy; do not re-theme even for brand contrast. Studies cited in compass show palette directly influences public perception of severity.
- Light-dark oscillation across classes is intentional — preserves differentiation for color-blind viewers. Don't smooth it.
- Always include the legend; not every viewer is climate-literate.
- Use Fahrenheit OR Celsius consistently per render — never both. `units: F | C` on compose.

## Acceptance (parity)
- Reference frames: 0 (today), 30 (tomorrow), 60 (3-day), 120 (heat-wave peak)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Temperature heat maps
- Emily Meriam / Esri / NWS canon
- ADR-004
