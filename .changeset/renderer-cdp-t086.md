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
`vendor/engine/src/services/videoFrameExtractor.ts`: same ffmpeg
argv shape (`-ss` before `-i`, `-t` optional, `-vf fps=`, 5-digit
pattern, JPG `-q:v` curve, PNG `-compression_level 6`) so extracted
frames are byte-compatible with the upstream engine at the same
inputs. The wrapper is fresh and uses our ChildRunner — no direct
use of Node's `child_process`.

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
