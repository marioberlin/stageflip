---
id: olympic-swim-lane-track
cluster: ar
clipKind: arOverlay
source: docs/compass_artifact.md#olympic-swimming-lane-tracker
status: stub
preferredFont:
  family: Games-specific (Paris 2024 etc.)
  license: proprietary-byo
fallbackFont:
  family: Atkinson Hyperlegible
  weight: 600
  license: ofl
permissions: [network]
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Olympic Swim Lane Track — virtual record-line overlay

## Visual tokens
- AR-composited lane graphics overlaid between physical lane dividers
- Appears to float on the water surface
- National flag colors per lane for identification
- Virtual world-record / Olympic-record line: red / gold, crosses the pool perpendicular to lanes, marking record pace
- Real-time position numbers (1, 2, 3) per lane updated mid-race
- Touch-pad-derived split times appear instantly with flash on touch

## Typography
- Lane numbers: Bold, 22–26 pt, tabular
- Times: Bold, 24–30 pt, tabular — to .01 second precision (Omega touch-pad standard)
- Record indicators (WR / OR / PB / SB): Bold, 18–22 pt, ALL CAPS
- Athlete names + countries: Bold, 16–20 pt

## Animation
- Lane graphics track with camera movement (sophisticated camera tracking required — Omega Vionardo or equivalent)
- Position-numbers update mid-race with 200 ms tick animation
- Touch / finish: flash on touch (250 ms), time populates within 100 ms
- World / Olympic record: flash gold + red, 600 ms peak
- ISO Track 2.0 style pointer graphics: optical tracking shows names, rankings, headshots above each swimmer

## Rules
- The virtual world-record line is the dramatic differentiator — preserve it. Without it, viewers can't perceive record pace.
- Requires camera-tracking + timing-data feed. Without both, fall back to a 2D scoreboard (cluster B `wimbledon-green-purple` register adapted, or escalate).
- Time precision: .01 seconds (touch-pad standard). Do NOT round; the canon is precision.
- Records: gold / red flash on world records (the most electrifying broadcast moment per compass). Don't soften.

## Acceptance (parity)
- Reference frames: 0 (start), 60 (mid-race), 120 (finish + touch flash), 150 (record flash)
- PSNR ≥ 34 dB (live AR + camera motion has high variance), SSIM ≥ 0.91

## References
- `docs/compass_artifact.md` § Olympic swimming lane tracker
- Omega Vionardo + SMT ISO Track 2.0
- Phelps' 0.01-second victory in 2008 (compass canonical moment)
- Frontier: `ThreeSceneClip` + `LiveDataClip` (timing feed)
- ADR-004
