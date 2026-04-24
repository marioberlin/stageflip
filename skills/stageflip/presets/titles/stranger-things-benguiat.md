---
id: stranger-things-benguiat
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#stranger-things
status: stub
preferredFont:
  family: ITC Benguiat Bold
  license: commercial-byo
fallbackFont:
  family: Cormorant Garamond
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Stranger Things — Benguiat title sequence

## Visual tokens
- Background: deep black `#000000`
- Title glow: red `#FF0000` → `#CC0000` range, simulating neon torch through canvas
- Optical film grain (subtle, animated noise)
- Light leaks (warm orange, intermittent)
- Atmospheric dust particles drifting
- Letters in extreme close-up — typeface fills the screen

## Typography
- Title: ITC Benguiat Bold fallback, ALL CAPS, scaled to fill the viewport
- Credits: ITC Avant Garde Gothic fallback (Geomanist or DM Sans as alternative), Regular, 22–28 pt

## Animation
- Letters drift slowly from different directions, sliding together like puzzle pieces, ~50 s total
- Red neon glow builds gradually — torch through canvas simulation
- Pacing synchronized to a synth score (Survive-canon); preset takes a `musicCue` slot
- Camera does not move — letterforms move; this distinction matters

## Rules
- The Benguiat fallback is critical; if no fallback adequate, escalate. The font is the show.
- No fast cuts. Pacing is meditative. Don't compress the sequence below 40 s without explicit permission.
- ALL CAPS, scaled to viewport — do not shrink. The point is letterform-as-environment.
- Glow is warm red, never blue / cyan. The register is 80s analog warmth.
- Optical film grain is mandatory; clean digital looks wrong.

## Acceptance (parity)
- Reference frames: 0 (pre-letter-entry), 240 (mid-assembly), 480 (full assembly + glow), 1200 (final pose at 50 s @ 24 fps)
- PSNR ≥ 36 dB (film grain reduces precision), SSIM ≥ 0.92

## References
- `docs/compass_artifact.md` § Stranger Things
- Imaginary Forces (Michelle Dougherty); 2017 Creative Arts Emmy
- ADR-004
