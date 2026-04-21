---
"@stageflip/renderer-cdp": minor
---

Video-frame pre-extraction (T-086).

Spawns ffmpeg to decode a source video into one PNG (or JPG) per
composition frame in a target directory. The CDP live-capture path
then swaps these stills in instead of relying on HTML `<video>`
playback during BeginFrame, which is non-deterministic.

New module `packages/renderer-cdp/src/video-frame-extractor.ts`:

- `buildExtractFramesArgs(opts)` — pure argv builder. Returns
  `{ args, framePattern, outputPath }`. Testable without spawning.
- `extractVideoFrames(opts)` → `ExtractVideoFramesResult`. Spawns
  via the T-085 `ChildRunner` seam, closes stdin immediately, awaits
  exit, raises `ExtractVideoFramesError` (with stderr attached) on
  non-zero exit.

Adapted from the vendored engine's
`vendor/engine/src/services/videoFrameExtractor.ts`. Preserved
behaviour: `-ss` before `-i` (fast keyframe seek), `-t` for
duration, `-vf fps=N` output rate, 5-digit pattern
`frame_%05d.<ext>`, upstream JPG quality curve
`Math.ceil((100 - quality) / 3)`. Decoded pixels are identical to
upstream for the same inputs.

Deliberate argv deviations (decoded pixels unaffected):
- Adds `-hide_banner -loglevel error` to match this package's own
  `ffmpeg-encoder.ts` house style.
- Emits `-y` once up-front (upstream: at the end).
- PNG path omits upstream's `-q:v 0` (PNG is lossless; that arg is
  a no-op). `-compression_level 6` preserved.

The wrapper is fresh and uses our ChildRunner — no direct use of
Node's `child_process`.

Input validation is fail-loud:
- `fps` positive finite.
- `startTimeSec` non-negative finite (default 0).
- `durationSec` positive finite when provided (omit for "to end").
- `quality` 0..100 for JPG output.
- `videoPath` non-empty.

Test surface: 11 cases for the extractor (+ existing 112 = 123
total across 13 files). Covers argv happy paths, PNG vs JPG
divergence, validation errors, spawn orchestration, custom
ffmpegPath, and non-zero-exit error propagation.
