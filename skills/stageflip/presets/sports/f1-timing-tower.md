---
id: f1-timing-tower
cluster: sports
clipKind: scoreBug
source: docs/compass_artifact.md#formula-1
status: stub
preferredFont:
  family: Formula1 Display
  license: proprietary-byo
fallbackFont:
  family: Barlow Condensed
  weight: 600
  license: ofl
permissions: [network]
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# F1 Timing Tower — scoreBug vertical

## Visual tokens
- Vertical tower on the LEFT side, ≈ 180 px wide @ 1080p
- Lists all 20 drivers, each row ≈ 30 px tall
- Background: carbon-black `#0D0D0F` @ 80% opacity
- Each row: thin team color stripe (3–4 px wide) on the leading edge
  - Ferrari `#ED1C24`, Red Bull `#1E5BC6`, Mercedes `#6CD3BF`, McLaren `#F58020`, Alpine `#2293D1`, Aston Martin `#2D826D` (extend per current grid)
- F1 brand red `#E10600` for highlights / podium / fastest laps
- Sector timing colors (mandatory, universal shorthand):
  - Purple `#6F2E9E` — session best
  - Green `#00B54A` — personal best
  - Yellow `#F0C800` — slower than personal best

## Typography
- Driver codes (3-letter): Bold, 14–16 pt, tabular
- Gap / delta times: Regular, 12–14 pt, tabular — truncated, not rounded (per compass)
- Position numbers: Bold, 16–18 pt

## Animation
- Entry: tower slides in from left with ease-out, 400–600 ms
- Position changes: smooth sliding row animations, 300 ms
- Purple sector bars: brief pulse (100 → 180 ms) when a record is set
- "Smart glass" (2022+): can highlight a specific row when commentators reference a driver — implemented as `highlightIndex` prop

## Rules
- Team-color stripe is NON-NEGOTIABLE — it's the instant-ID system. Do not collapse to monochrome.
- Sector color palette (purple / green / yellow) must not be re-themed; it's universal shorthand.
- Gap times are truncated, never rounded (`+0.124` not `+0.12`).
- Typography fallback must support tabular numerals — escalate if fallback does not.
- Requires live data via `LiveDataClip` (ADR-005). Without frontier enabled, renders `staticFallback` showing a frozen snapshot.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 20 (mid-slide), 40 (settled), 80 (post-position-change)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Formula 1
- Frontier: `LiveDataClip` (ADR-005 §D1)
- ADR-004
