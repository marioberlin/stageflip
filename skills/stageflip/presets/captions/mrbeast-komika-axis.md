---
id: mrbeast-komika-axis
cluster: captions
clipKind: caption
source: docs/compass_artifact.md#mrbeast
status: stub
preferredFont:
  family: Komika Axis
  license: commercial-byo
fallbackFont:
  family: Bangers
  weight: 400
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# MrBeast-style — Komika Axis caption

## Visual tokens
- Very large display, only 1–2 words at a time
- Base: white `#FFFFFF` and black `#000000`
- Highlights: bright green `#00FF00` with glow effect (10–15 px outer glow at 60% opacity)
- Heavy stroke: 4–6 px white or black around glyphs
- No background box
- Position: centered, sometimes anchored to on-screen objects (face, product)

## Typography
- Komika Axis fallback (Bangers): comic-style display
- Very large — 100–140 pt @ 1080p
- ALL UPPERCASE for emphasis; some captions Mixed Case for casual moments

## Animation
- Quick pop-in / zoom-in synced to rapid speech, 150 ms (faster than Hormozi)
- Keywords change to green with glow on emphasis, 200 ms
- Immediate snap-cut replacement between words — no fades, no overlap
- Ultra-fast pacing: 1–2 words at a time means many caption events per second of speech
- Optional anchor-to-object: caption appears beside on-screen money / product / face

## Rules
- 1–2 words at a time is the canonical word count. More breaks the register.
- Snap-cut replacement is mandatory; cross-fades make it feel slow.
- Komika Axis fallback (Bangers) must preserve the comic-display register — do not substitute a serious-tone display font.
- Green + glow is for monetary amounts and "winning" moments — don't apply to neutral words.
- Pacing is fast; expect 30–40 caption events per minute of speech.

## Acceptance (parity)
- Reference frames: 0 (pre-word), 4 (word entering at speed), 8 (settled), 12 (replaced by next word)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § MrBeast
- 386M+ subscribers read this caption style daily
- Gap clip T-316 (`CaptionClip`)
- ADR-004
