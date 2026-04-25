---
id: bbc-mark-allen-clouds
cluster: weather
clipKind: weatherMap
source: docs/compass_artifact.md#bbc-weather
status: stub
preferredFont:
  family: BBC Reith Sans
  license: proprietary-byo
fallbackFont:
  family: Source Sans 3
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# BBC Mark Allen Clouds — weatherMap

## Visual tokens
- Mark Allen 1975 symbol set: fluffy clouds, sun rays, raindrops — flat icon style
- 2005+ canon: 3D rotating globe (Weatherscape) replacing flat maps
- Cloud represented by darkening the map surface, not a separate icon (per 2005 evolution)
- Temperature on colored discs (gradient: blue → green → yellow → orange → red)
- 8-point grid (BBC GEL design system)

## Typography
- Temperature numbers: BBC Reith Sans fallback, Bold, 22–28 pt, high-contrast on colored discs
- Region labels: Regular, 16–20 pt
- Time-of-day labels: Light, 14–16 pt

## Animation
- 3D globe rotates and tilts; camera swoops from wide European view to UK regional close-up, 4–6 s
- Rain areas pulse blue; snow drifts in white; clouds darken the surface progressively
- App-companion icons: 32 weather states, each keyframed for seamless transitions
- Use `ThreeSceneClip` for the live globe; static fallback shows a frozen regional view

## Rules
- Mark Allen's symbol set is iconic British culture — do not modernize / replace. Even subtle redesigns triggered controversy historically.
- Scotland appearing disproportionately small is a known projection issue; tenants can opt for the equirectangular projection variant if needed.
- Globe rotation is calm — not dramatic. Don't accelerate to "look exciting"; the BBC register is calm authority.

## Acceptance (parity)
- Reference frames: 0 (globe entry), 60 (zoom in to UK), 120 (settled), 180 (forecast progression)
- PSNR ≥ 38 dB, SSIM ≥ 0.95

## References
- `docs/compass_artifact.md` § BBC Weather
- Mark Allen designs survived 30+ years; fallback symbols must match silhouette and visual weight
- Frontier: `ThreeSceneClip` for the live globe
- ADR-004
