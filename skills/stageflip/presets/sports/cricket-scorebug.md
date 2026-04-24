---
id: cricket-scorebug
cluster: sports
clipKind: scoreBug
source: docs/compass_artifact.md#cricket-scorebug
status: stub
preferredFont:
  family: Custom Star Sports / ICC
  license: proprietary-byo
fallbackFont:
  family: IBM Plex Sans
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Cricket Scorebug — top-of-screen complex register

## Visual tokens
- Top of screen, ≈ 40–50% of frame width
- Team colors dominant (India blue `#0066B3`, Australia gold `#FFCD00`, etc., extend per fixture)
- Simultaneous information:
  - Batting team score (runs / wickets)
  - Overs + run rates (current + required)
  - Both batsmen with individual scores + balls faced
  - Current bowler with figures
  - Partnership runs
- Ball-by-ball dot row: last 6 deliveries
  - Dot `⋅` = 0 runs (neutral gray)
  - Green `#00B54A` = 4 (boundary)
  - Purple / gold `#FFCD00` = 6 (six)
  - Red `#CC0000` = wicket

## Typography
- Team abbreviations / player surnames: Bold, 16–18 pt, tabular
- Scores / figures: Bold, 18–22 pt, tabular
- Overs / rates: Regular, 14–16 pt, tabular

## Animation
- Ball-by-ball pulse / flash on score change, 200 ms
- Wickets: dramatic red flash + dismissal-type label (bowled / caught / LBW / stumped / run-out), 500 ms
- Boundaries: green flash (4) or gold flash (6), 400 ms
- Milestone (50, 100 runs): golden flash + callout, 800 ms
- Between-overs: expand to show bowling change info, 600 ms ease-in-out

## Rules
- Ball-by-ball dot row is the signature — do not collapse or hide.
- Color semantics for the dot row are universal cricket canon; do not re-theme.
- Milestone animations are mandatory at 50 / 100 / 150 runs; milestone-flash is a cultural expectation.
- This is the densest scorebug in any sport — resist "simplifying" by removing columns.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 20 (settled), 40 (post-ball-change), 60 (post-wicket)
- PSNR ≥ 38 dB (relaxed for dense-text rendering variance), SSIM ≥ 0.96

## References
- `docs/compass_artifact.md` § Cricket scorebug
- Pairs with cluster E `cricket-ball-by-ball-dots` for standalone dot display
- ADR-004
