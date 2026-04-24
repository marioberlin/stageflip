---
id: olympic-medal-tracker
cluster: data
clipKind: standings
source: docs/compass_artifact.md#olympic-medal-tracker
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

# Olympic Medal Tracker — standings register

## Visual tokens
- Persistent sidebar or lower-third with top nations ranked by gold count
- Medal colors (canonical, do not re-theme):
  - Gold `#FFD700`
  - Silver `#C0C0C0`
  - Bronze `#CD7F32`
- Per-Games "Look of the Games" palette layered as accent (e.g., Paris 2024 blue / red / gold)
- Country flags as identification anchors
- Records indicators: WR (world), OR (olympic), PB (personal), SB (season)

## Typography
- Country codes / names: Bold, 18–22 pt, tabular
- Medal counts: Bold, 22–26 pt, tabular
- Records flash: Bold, 20–24 pt, ALL CAPS

## Animation
- Medal counts: increment with pulse animation, 300 ms (use `big-number-stat-impact` curve)
- World Records: flash gold / red with "WR" indicator animating large, 600 ms
- Event results populate in finishing order with stagger animations, 100 ms between rows
- Paris 2024 innovation: athletes' family heart-rate monitors visible as live BPM graphics (optional, gated on tenant data agreement)

## Rules
- Gold-silver-bronze color system transcends language; do not customize.
- "WR" / "OR" flash is mandatory on records; this is one of the most electrifying broadcast moments. Don't soften.
- 329+ events × 33+ sports — preset must handle entirely different scoring systems gracefully via the underlying `Standings` clip.
- Per-Games palette is layered, not replacing — gold / silver / bronze remain primary.

## Acceptance (parity)
- Reference frames: 0 (settled), 30 (post-medal-update), 60 (WR flash peak), 120 (settled-after-flash)
- PSNR ≥ 40 dB, SSIM ≥ 0.97

## References
- `docs/compass_artifact.md` § Olympic medal tracker
- NBC's Chyron PRIME pipeline for real-time 2D/3D
- Frontier: `LiveDataClip` for live results feed
- ADR-004
