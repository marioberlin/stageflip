---
id: cnn-classic
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#cnn
status: stub
preferredFont:
  family: CNN Sans
  license: proprietary-byo
fallbackFont:
  family: Inter Tight
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# CNN Classic — lower third

## Visual tokens
- Banner: `#FFFFFF` fill, width ≈ 75% of frame
- End cap: `#CC0000` flag on the far left (Boston University Red / PMS 2347 C)
- Post-2023 refinement: single upper-right rounded corner, radius 8 px @ 1080p
- CNN bug: rounded white box, bottom-right
- Ticker strip: dark gray `#333333` → `#1A1A1A` gradient below main banner
- Banner dimensions: ≈ 1400 × 100 px @ 1080p, positioned 60–80 px from bottom

## Typography
- Headline (`title`): Bold Condensed, UPPERCASE, 28–36 pt, `#000000`
- Talent ID (`name`, `role`): Regular, Mixed Case, 20–24 pt, `#000000`
- Ticker text: Regular, Mixed Case, 18–22 pt, `#FFFFFF` on dark strip

## Animation
- Text change: red block wipe L→R over the banner, 600 ms ease-out. New text is revealed beneath the wipe.
- LIVE bug: slow red pulse, 2 s cycle, never exceed 0.6 → 1.0 opacity range.
- Ticker: flipper between items (BBC-style) — each item prefaced by a red chevron `▶`.
- Exit: reverse wipe L←R, 500 ms, or hard cut.

## Rules
- Use for: urgent-but-ongoing coverage, developing story during live programming.
- Do not use for: resolved story updates (drop the red flag; use a non-CNN cluster-A preset or the `ongoing-update` compose path).
- Do not crossfade text changes — the red block wipe is the brand signature.
- Do not paint the full banner red; the flag end-cap is the identifier.

## Acceptance (parity)
- Reference frames: 0 (entry complete), 15 (wipe mid-change), 30 (new text settled), 60 (steady-state)
- PSNR ≥ 40 dB vs. reference, all four frames
- SSIM ≥ 0.97 across the full shot

## References
- `docs/compass_artifact.md` § CNN, § CNN Breaking News banner
- ADR-004 (preset system)
- Type-design batch review: `reviews/type-design-consultant-cluster-a.md` (pending)
