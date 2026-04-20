---
title: Captions
id: skills/stageflip/concepts/captions
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-184
related:
  - skills/stageflip/modes/stageflip-video/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Captions

StageFlip.Video ships auto-generated captions that stay synced to the audio
within **±100 ms** across every produced aspect ratio.

## Pipeline

1. Source audio is extracted to 16 kHz mono PCM.
2. Whisper API transcribes, returning word-level timestamps.
3. Words are grouped into "caption cells" sized for readability (max 2 lines,
   max ~40 chars per line at 16:9; tighter at 9:16).
4. Cells are attached to the timeline as `caption` elements with start/end
   frames aligned to the RIR timing grid.
5. The validator checks end-of-caption to end-of-spoken-phrase drift on a
   sample grid; drift > 100 ms fails the gate.

## Determinism and caching

- Transcription is cached by `sha256(audio-bytes || language-hint)`. Identical
  input bytes never re-hit Whisper.
- The cache is a content-addressed store; same hash across dev/CI/prod.
- Cell packing is deterministic: same transcript + same target aspect ratio
  → same cells byte-for-byte.

This means "re-render the same video" never re-incurs Whisper cost or drifts
captions.

## Aspect-bounce interaction

When a video is bounced to 9:16 / 1:1 / 16:9 (T-185), the caption packing
re-runs per aspect. Transcript text is identical; cell boundaries differ
because max-chars-per-line differs.

## Styling

Caption appearance comes from the theme's caption slot (`theme.captions.*`).
Burned-in vs. sidecar `.vtt` is an export-time choice. IAB banners don't
support captions (budget-forbidden); see `concepts/display-budget`.

## Related

- Mode: `modes/stageflip-video/SKILL.md`
- Task: T-184 (impl), T-185 (aspect bounce)
- Whisper SDK: pinned in `docs/dependencies.md`
