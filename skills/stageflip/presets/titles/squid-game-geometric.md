---
id: squid-game-geometric
cluster: titles
clipKind: titleSequence
source: docs/compass_artifact.md#squid-game
status: stub
preferredFont:
  family: Squid Game custom geometric
  license: proprietary-byo
fallbackFont:
  family: Anton + Bebas Neue
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Squid Game — geometric brutalist title

## Visual tokens
- Hot pink / magenta `#E91E63`
- Teal / dark green `#067162`
- Black `#000000`
- White `#FFFFFF`
- Korean title integration: ○ (circle) for "O", △ (triangle) for "J", □ (square) for "M" (Korean initials)
- Kraft paper card texture for in-show business cards (optional element)

## Typography
- Title typeface: custom geometric sans-serif with squared-off, brutalist letterforms
- Fallback: Anton + Bebas Neue stack (Anton for headline mass, Bebas for compressed cuts)
- ALL CAPS, scaled to fill
- Bilingual: Latin + Hangul, Hangul render via Pretendard or Spoqa Han Sans

## Animation
- Relatively static / minimal: bold typography against flat colored backgrounds, ~5 s
- Optional: ○ △ □ symbols enter sequentially with hard-cut snap, 200 ms per symbol
- Color contrast jump cuts (pink → teal → black → pink) — instant, no fades
- Pacing is brutal and contained; do not soften with eases

## Rules
- ○ △ □ symbols are the brand signal — must be present in any composition that cites this preset.
- Pink-on-teal is the iconic combination; do not substitute. (It became a viral Halloween costume palette.)
- Brutalism is the register — no rounded corners, no shadows, no gradients.
- Korean title integration is mandatory if rendering for any Korean-language audience; do not Latinize.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 30 (first symbol), 60 (full title), 120 (steady)
- PSNR ≥ 42 dB (flat color register has low variance), SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Squid Game
- ADR-004
