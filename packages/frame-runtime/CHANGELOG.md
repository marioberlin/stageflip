# @stageflip/frame-runtime

## 1.0.0

### Major Changes

- ec428bb: Move `interpolatePath` from the main entry to a dedicated
  `@stageflip/frame-runtime/path` sub-entry. Consumers that morph paths
  update their import:

  ```diff
  - import { interpolatePath } from '@stageflip/frame-runtime';
  + import { interpolatePath } from '@stageflip/frame-runtime/path';
  ```

  Rationale: flubber (~18 KB gz) was the dominant cost in the base bundle
  and pushed us within 0.95 KB of the 25 KB budget after T-053. Splitting
  it into a sub-entry drops the main bundle to ~5.3 KB gz (10 KB new
  limit) and keeps the sub-entry at ~19.5 KB gz (25 KB limit). Callers
  that don't morph paths save the full 18 KB.

  Public-API freeze (T-054) policy allows this as a major bump. Package
  is still `private: true` and pre-1.0; documented in
  `docs/dependencies.md` §4 Audit 3 addendum and
  `skills/stageflip/runtimes/frame-runtime/SKILL.md` I-14 section.

### Minor Changes

- 3871486: Public API freeze before Phase 3 (T-054).

  - `react` and `react-dom` move from `dependencies` to `peerDependencies`
    (`^19.0.0`). Consumers that already install React get one React copy;
    previously they would have shipped two.
  - `react` and `react-dom` added as `devDependencies` (pinned `19.2.5`) for
    tests.
  - `culori` and `flubber` remain regular runtime `dependencies` — they are
    implementation details of `interpolateColors` / `interpolatePath` and
    their output shapes are wrapped by this package's own formatter, not
    re-exported.

  Surface locked. Additions after this ship as a minor bump; removals or
  breaking signature changes require a major. See
  `skills/stageflip/runtimes/frame-runtime/SKILL.md` for the documented
  surface.

- a248a29: Add `useAudioVisualizer(ref, options?)` (T-053).

  Wires an `HTMLMediaElement` through a Web Audio `AnalyserNode` and returns
  `{ frequency, waveform, volume }` per frame. Editor / preview only — not
  determinism-clean because analyser output depends on wall-clock-driven
  decoder state. `AudioContext` creation is deferred to mount; pass
  `audioContextFactory` to inject a custom context (or a stub in tests).
  Validates `fftSize` (power of two, 32..32768) and
  `smoothingTimeConstant` ([0, 1]).

- 844a620: T-131e.0 — new `<FrameVideo>` / `<FrameAudio>` / `<FrameImage>`
  wrappers in `@stageflip/frame-runtime/media-host`. Video + audio
  wrappers delegate playback-clock sync to the existing `useMediaSync`
  hook; the image wrapper is a window-gated mount (no `.currentTime`
  on `<img>`, animated GIFs advance at browser pace — frame-accurate
  GIF seek belongs in the bake runtime). Prerequisite for the T-131e
  bake-tier clip ports (video-background, gif-player, voiceover-
  narration, audio-visualizer-reactive) and side-unblocks T-131f.4
  (audio-visualizer real-audio variant).
- 6cb351f: Add `useMediaSync(ref, { offsetMs?, durationMs? })` (T-055).

  Imperatively drives `<video>` / `<audio>` `.currentTime` to match the
  FrameClock, and manages play/pause based on whether the current frame
  falls inside `[offsetMs, offsetMs + durationMs)`. Skips redundant seeks
  when drift is within half a frame. `play()` rejections (autoplay
  policies) are swallowed silently.
