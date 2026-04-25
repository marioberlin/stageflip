---
id: netflix-invisible
cluster: captions
clipKind: caption
source: docs/compass_artifact.md#netflix-subtitles
status: stub
preferredFont:
  family: Netflix Sans
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 400
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Netflix Invisible — strict accessibility subtitle

## Visual tokens
- Bottom-center, center-justified
- Text: white `#F7F7F7` (slightly off-white per Netflix canon)
- Stroke: thin 2–3 px black OR a 30–40% opacity black drop shadow (one or the other, not both)
- 42 characters per line maximum, 2 lines per event maximum
- User-configurable: black background bar option; configurable text size for accessibility

## Typography
- Netflix Sans fallback (Inter): humanist sans-serif
- Regular (400), 22–28 pt
- Mixed Case

## Animation
- Entire subtitle event appears at once, no word-by-word
- Minimum duration: 5/6 second (833 ms)
- Maximum duration: 7 seconds
- No fades on entry / exit — clean appearance / disappearance
- Intentionally minimal — subtitles are infrastructure, not decoration

## Rules
- 42-char-per-line, 2-lines-max, 833 ms minimum — these are FCC and Netflix style guide rules. The validator enforces them; failure is a hard error, not a warning.
- No fades, no slide-ins, no animations. The point is invisibility.
- This is the only preset in the cluster that should be invoked when accessibility-strict subtitles are required (deaf / hard-of-hearing audiences).
- "Iconic because they're invisible" — the brief should never be "make these subtitles pop." Use a different preset for that.

## Acceptance (parity)
- Reference frames: 0 (subtitle event 1 visible), 30 (still 1), 60 (event 1 ended), 90 (event 2 visible)
- PSNR ≥ 44 dB (low motion = high precision), SSIM ≥ 0.99

## References
- `docs/compass_artifact.md` § Netflix subtitles
- Netflix Style Guide: 42 chars / 2 lines / ≥833 ms / ≤7 s
- Gap clip T-316 (`CaptionClip`) — must enforce strict-mode validation
- ADR-004
