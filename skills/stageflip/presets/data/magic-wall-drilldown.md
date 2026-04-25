---
id: magic-wall-drilldown
cluster: data
clipKind: fullScreen
source: docs/compass_artifact.md#cnn-magic-wall
status: stub
preferredFont:
  family: CNN Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 600
  license: ofl
permissions: [network]
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Magic Wall Drill-down — election / data fullScreen

## Visual tokens
- Multi-touch interactive map register
- County-level granularity for U.S. elections (extends to other geographies per region pack)
- Dem Blue `#0044CC` and Rep Red `#CC0000` (canonical; tenants can opt for partisan-neutral palette)
- WebGL + Web Sockets architecture (Code and Theory canon)
- "Theatrical" pop / animation — designed for camera, not just dashboard

## Typography
- Region labels: Bold, 22–28 pt, tabular
- Vote totals: Bold, 28–36 pt, tabular
- Percentages: Regular, 18–22 pt, tabular

## Animation
- Pinch-and-zoom drill-downs from state → county → precinct, 600 ms ease-in-out per step
- Animated vote tally count-ups (use `big-number-stat-impact` count-up curve)
- Color transitions as results arrive — smooth interpolation, 400 ms per update
- "Pop in a theatrical way that would look great on camera" — every animation has anticipation + overshoot
- 2024+ canon: works on mobile apps (CNN debut for mobile)

## Rules
- This preset assumes a live data feed. Without `LiveDataClip` enabled, fall back to a frozen-result snapshot.
- Theater is a feature: anticipation + overshoot are intentional. Don't lint them out for "smoothness."
- Color palette default is Dem Blue / Rep Red; tenants for non-US politics or partisan-neutral coverage configure `partyPalette` per compose.
- Pinch / touch UX is illustrative; preset's actual operator is the animation engine, not real touch.

## Acceptance (parity)
- Reference frames: 0 (state level), 60 (zoom mid), 120 (county level), 180 (post-tally update)
- PSNR ≥ 38 dB, SSIM ≥ 0.95

## References
- `docs/compass_artifact.md` § CNN Magic Wall
- Code and Theory canon
- Frontier: `LiveDataClip` for live election feed
- ADR-004
