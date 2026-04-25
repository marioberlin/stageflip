---
id: sky-sports-ar-formations
cluster: ar
clipKind: arOverlay
source: docs/compass_artifact.md#premier-league-sky-sports-stats-overlays
status: stub
preferredFont:
  family: Sky Sports Sans
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Sky Sports AR Formations — pitch-anchored overlay

## Visual tokens
- Camera-tracked AR overlay on the football pitch surface
- Player position markers anchored to physical positions on the pitch
- Formation lines (4-3-3, 4-4-2, etc.) drawn between markers
- Sky Sports navy `#0A1128` for primary fill of marker badges
- Sport-specific accent (Premier League purple `#38003C`, F1 red, etc.) per fixture
- Player numbers / names floating above markers

## Typography
- Sky Sports Sans fallback (Inter), Bold, 16–22 pt
- Player numbers: tabular, distinct numeral design preserved

## Animation
- Anchored to camera tracking via Zero Density Reality Engine + Stype RedSpy data
- Markers track with the live camera as it pans / zooms (no manual keyframes)
- Formation lines: animate in sequentially, 200 ms per line, when AR overlay is invoked
- Player swap (substitution): old marker fades, new marker scales in, 400 ms total
- Use `ThreeSceneClip` for live AR; static fallback shows formation as a 2D pitch diagram

## Rules
- Requires camera-tracking input (Zero Density / Stype). Without it, fall back to 2D pitch diagram.
- Sky Sports' type-led canon: typography is the hero — formation lines are accents, not the focus.
- AR is broadcast-first. On mobile, render via `displayTier: mobile` mode that auto-reduces complexity.
- David Hill invented the persistent score bug at Sky Sports in 1992 — preset includes the optional score bug companion via cluster B preset reference.

## Acceptance (parity)
- Reference frames: 0 (formation entering), 30 (lines complete), 60 (camera mid-pan), 120 (settled with all markers)
- PSNR ≥ 36 dB (live AR composited frames have variance), SSIM ≥ 0.93

## References
- `docs/compass_artifact.md` §§ Sky Sports, Premier League / Sky Sports stats overlays
- DixonBaxi (2016–2020), Interstate (2023+), AE Live, IMG Media pipeline
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
