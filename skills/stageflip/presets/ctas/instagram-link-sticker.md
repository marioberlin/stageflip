---
id: instagram-link-sticker
cluster: ctas
clipKind: socialMedia
source: docs/compass_artifact.md#instagram-stories-link-sticker
status: stub
preferredFont:
  family: Instagram platform font (proprietary)
  license: platform-byo
fallbackFont:
  family: Inter
  weight: 500
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Instagram Link Sticker — Stories CTA

## Visual tokens
- Rounded pill sticker, ~200 × 44 px native
- Color cycle: white-on-dark, dark-on-white, frosted-glass variant, brand-color variant — tap to cycle (in editor)
- Customizable text (default: destination domain)
- Free-form draggable placement on the Story frame
- Subtle shadow on contrasting backgrounds

## Typography
- Instagram's proprietary system font, fallback to Inter Medium
- 14–16 px native
- Mixed case

## Animation
- No independent entry — sticker appears with the Story frame
- Subtle shimmer / highlight on text (3 s cycle, light sweep across glyphs)
- On tap: sticker depresses to 95% scale, 100 ms; expands a link-preview card from the bottom showing destination URL, 300 ms

## Rules
- Available to all accounts (post 10K-follower restriction removal). Always permitted; do not gate.
- Pill shape is the platform-recognizable signal; do not square it off.
- Place near the content's focal point, not the frame edge. Compass canon: this is the differentiator vs. the old swipe-up.
- Color variant should be chosen for legibility against the underlying media; default white-on-dark.

## Acceptance (parity)
- Reference frames: 0 (sticker entering with frame), 30 (settled), 60 (mid-shimmer), 90 (post-tap depress)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Instagram Stories link sticker
- Sticker UX pattern democratizing what used to be 10K-follower-gated
- ADR-004
