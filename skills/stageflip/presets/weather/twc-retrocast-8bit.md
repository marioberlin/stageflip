---
id: twc-retrocast-8bit
cluster: weather
clipKind: fullScreen
source: docs/compass_artifact.md#the-weather-channel
status: stub
preferredFont:
  family: WeatherStar 4000 8-bit pixel
  license: ofl-equivalent (custom)
fallbackFont:
  family: Press Start 2P
  weight: 400
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# TWC RetroCast — 1990s nostalgia register

## Visual tokens
- WeatherStar 4000 / 5000 era palette
- Deep blue backgrounds: `#000066` → `#000099`
- Orange / gold accent bars: `#FF9900`, `#DAA520`
- Temperature numbers: white `#FFFFFF` or gold `#DAA520`
- Iconic "L-bar" sidebar on the left (signature pre-2019 element)
- Pixel-precise alignment, no anti-aliasing

## Typography
- 8-bit pixel font (WeatherStar 4000 canon) — Press Start 2P fallback
- Sizes step in 8-px increments (no fractional sizing)
- Temperatures: 32–48 px tall (effective)
- Labels: 14–20 px
- ALL CAPS by default

## Animation
- Locked to 30 fps (period authentic) — not 60. Mark `frameRate: 30` on the preset compose.
- Ticker scrolls at integer pixel speeds only (1 px / 2 px / 4 px per frame)
- City-by-city panel transitions: hard cut, no fades
- Optional CRT-scan-line overlay (subtle, 4% opacity)

## Rules
- TWC officially launched RetroCast in 2025 — this is a first-class register, not a parody. Treat with same rigor as the IMR preset.
- Pixel-precision is non-negotiable: anti-aliased rendering breaks the register. Configure the frame-runtime export with `imageSmoothing: false`.
- Period-authentic music cues (smooth jazz / muzak) are part of the register; preset accepts a `musicCue` slot.
- Use 30 fps, not 60 — modern smoothness is wrong for the period.

## Acceptance (parity)
- Reference frames: 0 (panel entry), 30 (mid-scroll), 60 (settled), 90 (panel transition)
- PSNR ≥ 44 dB (pixel-perfect register has very low variance), SSIM ≥ 0.99

## References
- `docs/compass_artifact.md` § The Weather Channel (RetroCast)
- ADR-004
