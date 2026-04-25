---
id: uefa-starball-refraction
cluster: sports
clipKind: fullScreen
source: docs/compass_artifact.md#uefa-champions-league
status: stub
preferredFont:
  family: Champions (Fontsmith)
  license: proprietary-byo
fallbackFont:
  family: Fraunces
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# UEFA Champions League — Starball Refraction fullScreen

## Visual tokens
- Dark navy primary `#041E42` (night-match canon)
- Accent palette from refraction: bright blue `#2DA8D8`, cyan `#6EE0E8`, magenta `#C2185B`, white `#FFFFFF`
- The Starball: prism rendered at broadcast scale (originally delivered at 30K resolution by Framestore)
- Light refraction pattern traces across frame edges — connecting thread
- "Ultimate Stage" CGI stadium (optional, per broadcast cycle) as background composite

## Typography
- Match-card titles: Champions fallback, Bold, 36–42 pt, UPPERCASE
- 2024–27 cycle: "Champions Display Refracted" — characters partially take on different accent colors, inspired by the prism. Render as a per-character gradient fill in the preset's compose layer.
- Italic + "Ritalic" (reverse italic) variants available
- Subtitle / metadata: Regular, 20–24 pt

## Animation
- Starball intro: 3D-tracked shot from the match, Starball composited around players following camera movement (use `ThreeSceneClip` from ADR-005)
- Promo wipes using Starball shape: 28 frames (HD) / 36 frames (UHD)
- Light wave texture: slow continuous drift across the composition, 8–10 s cycle
- Per-character color gradient (Refracted variant): staggered 40 ms per character on reveal

## Rules
- Premium register — do not cheapen with low-resolution Starball assets. If the tenant lacks the 30K source, render from a higher-tier proxy only.
- Starball is 3D-tracked to match footage. Requires camera-track data or a pre-composited shot; without either, fall back to a 2D shape animation.
- Refraction palette is meant to evoke light physics; don't substitute a generic "cyberpunk" gradient palette.
- Requires `ThreeSceneClip` frontier enablement (ADR-005) for the live-composited register. Static register is available as fallback.

## Acceptance (parity)
- Reference frames: 0 (Starball entry), 30 (mid-motion), 60 (settled), 120 (refraction at full cycle)
- PSNR ≥ 38 dB (3D composites have more variance), SSIM ≥ 0.95

## References
- `docs/compass_artifact.md` § UEFA Champions League
- DesignStudio 2018 rebrand; Vasava 2024–27 refresh with the refraction concept
- Frontier: `ThreeSceneClip` (ADR-005 §D1)
- ADR-004
