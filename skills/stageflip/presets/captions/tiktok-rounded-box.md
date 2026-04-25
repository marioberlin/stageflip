---
id: tiktok-rounded-box
cluster: captions
clipKind: caption
source: docs/compass_artifact.md#tiktok-auto-captions
status: stub
preferredFont:
  family: TikTok Sans
  license: platform-byo
fallbackFont:
  family: Source Sans 3
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# TikTok-style — rounded-box caption

## Visual tokens
- Rounded-corner background box (radius 12 px @ 1080p)
- Box fill: black `#000000` @ 60–80% opacity (configurable per scene contrast)
- Text: white `#FFFFFF`
- 3–5 words per line at most, often 2–3
- Position: center or upper-center (avoiding the bottom 20–25% where TikTok UI overlays)
- Padding inside box: 12 px horizontal, 8 px vertical

## Typography
- TikTok Sans fallback (Source Sans 3): platform-native register
- Semibold (600), 32–42 pt @ 1080p
- Sentence case (mixed case)

## Animation
- Auto-generated captions appear line-by-line, synced to speech
- Box scales in: 0.95 → 1.0 with brief fade, 200 ms
- Internal text appears with the box — no word-level animation
- Snap-cut replacement between lines

## Rules
- Bottom 20–25% of vertical-video frame is reserved for TikTok UI (like / comment / share / sound). Default position is center; auto-shift to upper-center if the source video has prominent foreground.
- Rounded-corner box IS the effect — do not add stroke or shadow.
- Sentence case, not ALL CAPS — TikTok's algorithmic canon is mixed case.
- Cross-platform reposting: this style is so platform-recognizable that content reposted to Reels or Shorts still reads as TikTok. Own that.
- Word-level animation is NOT this register — that's Hormozi or MrBeast. TikTok auto-captions are line-based.

## Acceptance (parity)
- Reference frames: 0 (pre-line), 6 (box mid-scale), 12 (settled), 60 (replaced by next line)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § TikTok auto-captions
- Originally Proxima Nova Semibold; replaced by TikTok Sans (May 2023)
- Gap clip T-316 (`CaptionClip`)
- ADR-004
