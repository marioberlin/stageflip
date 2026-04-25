---
id: hawkeye-var-3d-skeletal
cluster: ar
clipKind: arOverlay
source: docs/compass_artifact.md#var-graphics
status: stub
preferredFont:
  family: Premier Sans / Champions
  license: proprietary-byo
fallbackFont:
  family: Space Grotesk
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Hawk-Eye VAR 3D Skeletal — offside decision overlay

## Visual tokens
- Freeze-frame from match footage as background
- 3D wireframe / skeletal model overlaid on each player involved (Hawk-Eye limb-tracking source)
- Highlighted joint points (shoulder, hip, foot)
- Bright colored offside lines:
  - Attacker line: red / orange `#FF6B35`
  - Last defender line: blue / green `#00B5D8`
- Decision banner: "VAR — CHECKING [GOAL/PENALTY/OFFSIDE]" in competition-specific font
- Background tint: PL purple `#34003A` with white text + green `#00FC8A` accents

## Typography
- "VAR — CHECKING ..." banner: Premier Sans / Champions fallback, Bold, 28–34 pt, ALL CAPS
- Player labels: Bold, 18–22 pt
- Decision result text ("GOAL CONFIRMED" / "GOAL DISALLOWED"): Bold, 32–40 pt, color-coded

## Animation
- Banner slides in with distinct audio cue (preset takes a `varAudioCue` slot), 400 ms
- Loading indicator pulses during review, 1.5 s cycle
- Offside lines draw onto the freeze-frame from screen edges, 600 ms
- 3D wireframe models scale in over players, 500 ms
- Decision reveal: brief pause (1 s), then green flash (goal confirmed) or red flash (overturned), 350 ms

## Rules
- Pause before reveal is the suspense — do not collapse it. The pause is the dramatic beat.
- 3D limb-tracking from Hawk-Eye: requires the source data. Without it, fall back to a 2D-line variant (`offside-2d-line` — separate preset, not in v1 catalog).
- Audio cue is mandatory; without it the banner feels routine. The audio is part of the canon.
- Most emotionally charged overlay in football — preserve the gravitas. Don't accelerate the timing.

## Acceptance (parity)
- Reference frames: 0 (banner entering), 30 (loading mid-pulse), 90 (lines drawn + skeletons), 150 (decision flash)
- PSNR ≥ 36 dB (3D overlay variance), SSIM ≥ 0.93

## References
- `docs/compass_artifact.md` § VAR graphics
- Hawk-Eye limb-tracking system
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
