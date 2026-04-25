---
id: cricket-ball-by-ball-dots
cluster: data
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
  typeDesign: na
---

# Cricket Ball-by-Ball Dots — over visualization

## Visual tokens
- Horizontal row of 6 dots representing the current over's deliveries
- Color semantics (universal cricket canon):
  - Neutral gray `#666666` = 0 runs (dot)
  - White `#FFFFFF` = 1 run
  - Cyan `#00B4D8` = 2 or 3 runs
  - Green `#00B54A` = 4 (boundary)
  - Purple / gold `#FFCD00` = 6 (six)
  - Red `#CC0000` = wicket
- Dot size: 16–20 px diameter @ 1080p
- Spacing: equal, ~24 px between centers

## Typography
- Optional run number inside dot: Bold, 12–14 pt
- Over count label: Regular, 14–16 pt

## Animation
- Each new ball: dot appears with a brief pop (180 ms scale 0.8 → 1.0)
- Wickets: red flash + brief bounce (250 ms)
- Boundaries: green / gold flash + 1.1 scale overshoot (300 ms)
- Between-overs: dot row clears with right-to-left wipe, 500 ms; new over begins from left

## Rules
- Color semantics are cricket canon; do not re-theme even for brand contrast.
- Do not show fewer than 6 dot positions — incomplete overs render with placeholder dots.
- Pair with `cricket-scorebug` (cluster B) when used in a full-broadcast context. This preset can stand alone for highlight reels and social cuts.
- If milestone (50, 100, 150) hits during the over, the dot triggering the milestone gets the boundary/six flash plus an additional milestone callout (cluster B `cricket-scorebug` handles this).

## Acceptance (parity)
- Reference frames: 0 (empty over), 12 (3 balls in), 24 (5 balls in), 36 (over complete)
- PSNR ≥ 42 dB (low-variance graphic), SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Cricket scorebug
- ADR-004
