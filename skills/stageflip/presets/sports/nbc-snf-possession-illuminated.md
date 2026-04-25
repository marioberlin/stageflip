---
id: nbc-snf-possession-illuminated
cluster: sports
clipKind: scoreBug
source: docs/compass_artifact.md#nbc-sunday-night-football
status: stub
preferredFont:
  family: Sweet Sans Pro + NBC Tinker
  license: commercial-byo + proprietary-byo
fallbackFont:
  family: Public Sans
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# NBC SNF Possession-Illuminated — scoreBug

## Visual tokens
- Horizontal bar at bottom-center
- Center circle: game clock, quarter, NBC logo
- Team sections flank left (home) and right (away)
- Dark / black `#0A0A0A` semi-transparent background (≈ 75% opacity)
- Team color accents (team primary as 4 px edge strip on the outer side of each team section)
- The bug ILLUMINATES on the left or right side depending on possession — subtle 8–12% brightness boost to the possessing team's section

## Typography
- Team abbreviations: Sweet Sans Pro fallback, Bold, 18–22 pt, tabular
- Scores: Bold, 26–32 pt, tabular
- Clock: Bold, 16–18 pt, tabular
- Down-and-distance: Regular, 16–18 pt, with directional chevrons — `<< 1st and 10 <<` indicating direction of play (compass: "a genuine innovation")

## Animation
- Entry: slides in from bottom, 500 ms ease-out
- Possession change: illuminated side transitions smoothly over 400 ms — both a brightness shift and a position adjustment for directional chevrons
- Penalty: animated yellow-flag indicator slides in from the center, 300 ms
- Score change: flash (200 ms), no bounce

## Rules
- Possession illumination is load-bearing UX — do not disable or flatten it. It communicates state without requiring reading.
- Directional chevrons must match play direction (left-to-right or right-to-left). This is the innovation; preserve it.
- Penalty-flag indicator appears only on actual penalties; do not reuse for non-penalty events.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 15 (mid-slide), 30 (settled), 60 (post-possession-change)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § NBC Sunday Night Football
- "Frequently rated the best current NFL score bug by design critics" — preserve the register faithfully
- ADR-004
