---
id: hormozi-montserrat-black
cluster: captions
clipKind: caption
source: docs/compass_artifact.md#alex-hormozi
status: stub
preferredFont:
  family: Montserrat Black
  license: ofl
fallbackFont:
  family: Montserrat
  weight: 900
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Hormozi-style — Montserrat Black caption

## Visual tokens
- Centered on screen, mid-frame vertical position
- Base text: white `#FFFFFF`
- Keyword highlights: yellow `#F7C204`, green `#02FB23`, red `#FF1F1F` (configurable per keyword via `highlightColors` map)
- Stroke: 3–5 px black, around every glyph
- Drop shadow: subtle, 0 / 4 px / 4 px blur, 30% opacity black
- No background box

## Typography
- Montserrat Black 900 (or "The Bold Font" — earlier Hormozi register)
- 80–100 pt @ 1080p, ALL UPPERCASE
- 4–6 words per line at ~80% frame width
- Line breaks chosen for reading rhythm, not just character count

## Animation
- Word-by-word pop-in from bottom with slight scale-up (0.9 → 1.0), 200 ms per word
- Active word changes to highlight color in sync with speech
- Key emphasis words scale up briefly (1.0 → 1.1 → 1.0), 250 ms
- Subtle bounce / elastic on pop-in (overshoot 1.04 → 1.0)
- Snap-cut between caption events (no fade-out)
- Synced precisely to audio word-level timestamps

## Rules
- Word-level timing is mandatory. The `CaptionClip` (T-316) takes word-level timestamps as input; sentence-level captions are wrong for this register.
- 4–6 words per line is the canonical word count; do not override without escalation.
- ALL UPPERCASE for emphasis is the signature.
- Keyword highlight colors are typically yellow / green / red — reserve red for negative-affect words ("never", "wrong") to match Hormozi's canon.
- Optional emoji overlays on key words (handled by `LyricsClip`-adjacent emoji track on `CaptionClip`).

## Acceptance (parity)
- Reference frames: 0 (pre-word), 6 (word entering), 12 (word at peak emphasis), 18 (word settled)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Alex Hormozi
- "Most widely imitated caption style in short-form video since 2022"
- Gap clip T-316 (`CaptionClip`)
- ADR-004
