---
id: karaoke-progressive-wipe
cluster: captions
clipKind: lyrics
source: docs/compass_artifact.md#karaoke-style-lyrics
status: stub
preferredFont:
  family: Bebas Neue
  license: ofl
fallbackFont:
  family: Bebas Neue
  weight: 400
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Karaoke Progressive Wipe — lyric video

## Visual tokens
- Bold display sans-serif, mass typographic register
- Inactive text: light gray `#CCCCCC` or white at 50% opacity
- Active / sung text: yellow `#F3CE32`, bright white at 100% opacity, or cyan `#00FFFF` (configurable per song's mood)
- 36–72 pt @ 1080p, filling 60–80% of screen width
- 2–3 px dark outline for separation from background
- No background box

## Typography
- Bebas Neue (default), Anton, or Montserrat Bold per the brief
- ALL CAPS for impact
- 1–2 lines visible at once

## Animation
- Defining technique: progressive **left-to-right color wipe** — each word or syllable transitions from dim to bright as it should be sung
- Timing: precisely synced to the musical beat (preset accepts a `musicCue` with beat-track or word-level timestamps)
- Lines fade out or slide up as the next line appears, 400 ms
- Modern variants: bounce on active word (1.0 → 1.05 → 1.0, 200 ms) or glow on active word (10 px outer glow building 100 ms)

## Rules
- Progressive color-fill wipe is the ancestor of all word-by-word caption styles (1970s karaoke canon). Every modern caption descends from this. Honor the heritage.
- Timing must be beat-aligned. Without a `musicCue`, the preset is unusable; escalate.
- Use `LyricsClip` (T-322), not `CaptionClip` — they're distinct gap clips because the timing model is musical, not transcription-based.
- ALL CAPS is canonical for high-impact lyric videos; Mixed Case is acceptable for ballad / acoustic register.

## Acceptance (parity)
- Reference frames: 0 (line entering), 30 (word 1 wiped), 60 (word 3 wiped), 120 (line settling, last word wiped)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Karaoke-style lyrics
- Gap clip T-322 (`LyricsClip`)
- ADR-004
