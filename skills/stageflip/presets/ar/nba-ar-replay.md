---
id: nba-ar-replay
cluster: ar
clipKind: arOverlay
source: docs/compass_artifact.md#part-7-and-part-8-ar-and-environmental
status: stub
preferredFont:
  family: NBA brand (custom)
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# NBA AR Replay — court-anchored trajectory / shot-arc overlay

## Visual tokens
- Court-anchored 3D AR overlay
- Shot trajectories: arcing line from launch to hoop, with peak height marker
- Player position markers anchored to court coordinates
- Movement vectors: arrows showing direction + speed
- Court color: hardwood-warm tone for the surface; lines render at 80% opacity to not obscure
- NBA brand orange `#C9082A` for highlight accents

## Typography
- Player names / numbers: Bold, 18–24 pt
- Stats overlays (points, FG%, distance): Bold, 16–22 pt, tabular
- Replay marker text ("REPLAY", "CLUTCH"): ExtraBold / Black, 28–32 pt, UPPERCASE

## Animation
- Replay trigger: footage slows to ~25% speed for the highlight, 1.5 s entry transition
- Shot arc: draws from launch point to basket along the trajectory, 800 ms ease-out
- Court markers: scale in 0.8 → 1.0 with brief overshoot, 250 ms each, staggered 100 ms
- Movement vectors: animate from origin point outward, 400 ms

## Rules
- Court-anchored overlay requires camera tracking. Without it, fall back to a 2D court diagram with shot chart (cluster E adaptation).
- Slowed replay footage (~25% speed) is the dramatic context — don't render at full speed.
- Shot arc must be physically plausible (parabolic, not arbitrary). Use the actual trajectory data when available.
- Use this register for highlight reels and replay segments, not real-time live coverage.

## Acceptance (parity)
- Reference frames: 0 (slow-mo entry), 36 (arc drawing mid-trajectory), 60 (arc complete + marker), 120 (settled with stats)
- PSNR ≥ 36 dB (3D + slow-mo footage variance), SSIM ≥ 0.93

## References
- `docs/compass_artifact.md` § Part 8 (AR/environmental sports overlays — NBA family)
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
