---
id: f1-sector-purple-green
cluster: data
clipKind: bigNumber
source: docs/compass_artifact.md#formula-1
status: stub
preferredFont:
  family: Formula1 Display
  license: proprietary-byo
fallbackFont:
  family: Barlow Condensed
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# F1 Sector Purple/Green — sector-time delta callout

## Visual tokens
- Standalone sector-time callout (not the full timing tower; that's `f1-timing-tower` in cluster B)
- Purple `#6F2E9E` for session-best sector
- Green `#00B54A` for personal-best
- Yellow `#F0C800` for slower-than-personal-best
- Driver code (3 letters) + sector number (S1 / S2 / S3) + time delta
- Background: subtle dark gradient or transparent, depending on context

## Typography
- Driver code: Bold, 24–28 pt, tabular
- Sector number: Bold, 18–22 pt
- Time: Bold, 28–34 pt, tabular, truncated (not rounded — `21.412` not `21.41`)
- Delta vs. session leader: Regular, 18–22 pt

## Animation
- Entry: slide-in from sector-context direction, 400 ms ease-out
- Color flash on threshold transition (e.g., set new session best → purple, 250 ms pulse)
- Number count: appears with brief tick-up on the last 2 digits only (subtle, 150 ms)
- Exit: slide out, 350 ms

## Rules
- Sector color palette (purple / green / yellow) is universal F1 shorthand — do not re-theme. Even if the broadcaster's brand wants different colors, do not.
- Time always truncated, never rounded — accuracy matters in motorsport.
- Only render in the context of an active sector — never render a stale time as a current sector. If the data is more than 30 s old, fall back to `staticFallback` showing the last valid time with a dimmed indicator.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 12 (mid-slide), 24 (settled), 48 (post-pulse-on-best)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Formula 1, § Dynamic sports results
- Pairs with cluster B `f1-timing-tower` for full coverage
- Frontier: `LiveDataClip` for sector telemetry
- ADR-004
