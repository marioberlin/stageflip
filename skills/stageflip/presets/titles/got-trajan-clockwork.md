---
id: got-trajan-clockwork
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#game-of-thrones
status: stub
preferredFont:
  family: Trajan Pro
  license: commercial-byo
fallbackFont:
  family: EB Garamond
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Game of Thrones — Trajan / clockwork title sequence

## Visual tokens
- 3D CG concave spherical world map
- Color palette: metallic golds and browns
  - Clinker `#331C0E`
  - Electric Brown `#B9540C`
  - Baby Yellow `#FFF190`
- Buildings of wood, stone, and metal that mechanically unfold via clockwork mechanisms
- Central heliocentric armillary sphere depicting historical events in relief
- Sun rays radiate from the center

## Typography
- Show title: Trajan Pro fallback, ALL CAPS, Roman inscription style, scaled large
- Credits: Trajan Pro fallback, Regular, 24–30 pt
- Signature serif details preserved in fallback (long ascenders, sharp serifs)

## Animation
- Camera swoops across the map as buildings rise and unfold via gear-driven mechanisms, 90 s ± per episode
- Per-episode variation: sequence changes based on featured locations
- Sigil flips: territorial control changes (e.g., Bolton flayed-man replacing Stark direwolf at Winterfell)
- Use `ThreeSceneClip` (ADR-005) for the live 3D rendering; static fallback is a single hero frame

## Rules
- Per-episode customization (which locations to highlight) is the signature; preset takes a `featuredLocations: string[]` input.
- Trajan is the typographic register of "myth" — fallback must preserve high contrast and inscriptional severity.
- Camera path is a swoop, not pan-zoom; preserve the cinematic feel.
- Clockwork mechanisms must look hand-crafted; do not use generic "geometric reveal" animations as substitutes.
- Sigil-flip mechanic: each sigil pair declared in compose; the animation handles the in-place flip with a heat-shimmer transition.

## Acceptance (parity)
- Reference frames: 0 (sun-ray entry), 240 (mid-camera-swoop), 480 (clockwork unfold peak), 720 (sigil reveal)
- PSNR ≥ 36 dB (3D + golds have variance), SSIM ≥ 0.92

## References
- `docs/compass_artifact.md` § Game of Thrones
- Elastic (Angus Wall, Robert Feng, Kirk Shintani); 2011 Emmy
- Frontier: `ThreeSceneClip` (ADR-005)
- ADR-004
