---
id: ali-abdaal-opacity-karaoke
cluster: captions
clipKind: caption
source: docs/compass_artifact.md#ali-abdaal
status: stub
preferredFont:
  family: TT Fors
  license: commercial-byo
fallbackFont:
  family: Poppins
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Ali Abdaal-style — opacity karaoke caption

## Visual tokens
- Lower-center background panel
- Panel fill: light pinkish-gray `#EBE9EC`, rounded corners (radius 16 px @ 1080p)
- Text: dark gray `#292629`
- Inactive words: 50% opacity
- Active word: 100% opacity
- ~70% frame width
- Optional 5° random rotation for subtle dynamism (gated per compose `microRotation: bool`)

## Typography
- TT Fors fallback (Poppins): rounded geometric sans
- Bold (700), 28–34 pt
- Sentence case (Mixed Case)
- Comfortable reading width: 60–70 chars per line max

## Animation
- Entire phrase appears at once on the panel (panel scales 0.97 → 1.0, 250 ms)
- Karaoke-style opacity increase: each word transitions 50% → 100% over its spoken duration
- No bounce, no scale on individual words — opacity only
- Optional 5° random rotation applied once when panel enters; does not animate

## Rules
- Opacity-based karaoke (not color-change) is the signature. Don't switch to color highlights.
- Panel background pink-gray must be light enough that it doesn't dominate the source video; configurable per scene contrast.
- Sentence case, not ALL CAPS — Ali Abdaal's "clean aesthetic" depends on lowercase reading.
- Random 5° rotation is intentional micro-motion; preserve it as opt-in.
- The opposite-of-Hormozi register: subtle, professional, education-aesthetic.

## Acceptance (parity)
- Reference frames: 0 (panel entering), 6 (panel settled), 24 (word 2 of 5 active), 60 (last word active)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Ali Abdaal
- "Widely adopted by educational and clean-aesthetic creators"
- Gap clip T-316 (`CaptionClip`)
- ADR-004
