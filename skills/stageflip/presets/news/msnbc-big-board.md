---
id: msnbc-big-board
cluster: news
clipKind: fullScreen
source: docs/compass_artifact.md#msnbc-big-board
status: stub
preferredFont:
  family: Roboto + NBC Tinker
  license: ofl + proprietary-byo
fallbackFont:
  family: Roboto + Inter Tight
  weight: 700
  license: ofl
permissions: [network]
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# MSNBC Big Board — interactive data fullScreen

## Visual tokens
- Full-screen interactive map / touchscreen register
- Virtual environment can host a 3D background (e.g., virtual White House, 30 Rock with projected data)
- High-contrast state / county / precinct overlays
- Operator cursor / touch overlay (Kornacki-style rapid-fire tap-and-swipe)
- Layered UI: map base, data overlay, callout panel

## Typography
- Headline / callout: NBC Tinker fallback, Bold, 36–48 pt
- Data labels: Roboto, Medium, 20–24 pt, tabular numerals
- Legend: Roboto, Regular, 16–18 pt

## Animation
- Zoom-in to states, counties, municipalities (pinch / touch-driven metaphor)
- Real-time vote count updates with animated number changes (see cluster E `big-number-stat-impact` for count-up behavior)
- 800 ms ease-out for map transitions; count-ups use physics-eased tick-up curves
- No hard cuts between zoom levels — cinematic sweep matters

## Rules
- Paired with cluster E's data presets when showing regional results. Do not inline-chart; compose.
- Requires a live or staged data source. If no live source, compose with `staticFallback` showing the last cached state.
- Kornacki-style operator cursor is an optional layer; gated on tenant preference.
- Do not adopt CNN's Magic Wall color palette (Dem Blue / Rep Red) as-is — defer to the tenant's partisan-color-neutral alternative when applicable.

## Acceptance (parity)
- Reference frames: 0 (wide establishing), 30 (zoom mid-transition), 60 (county-level settled), 120 (count-up-completed)
- PSNR ≥ 38 dB (slightly relaxed for map-tile variance), SSIM ≥ 0.95

## References
- `docs/compass_artifact.md` § MSNBC Big Board
- Pairs with: `skills/stageflip/presets/data/magic-wall-drilldown.md`
- Frontier: live data via `LiveDataClip` per ADR-005 (fallback to static otherwise)
- ADR-004
