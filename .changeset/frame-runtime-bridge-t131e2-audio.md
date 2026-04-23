---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131e.2 — audio tranche lands on the frame-runtime bridge. Two new
reference ports:

- `voiceover-narration` — text + SVG-waveform visualization of timed
  narration segments. Extends the reference with an optional
  `audioUrl` prop that mounts a hidden `<FrameAudio>` for
  playback-clock-synced narration. `themeSlots`: `background` →
  `palette.background`, `textColor` → `palette.foreground`, `color` →
  `palette.primary`.
- `audio-visualizer-reactive` — real-audio variant of T-131f.1's
  simulated `audio-visualizer`. Drives bar heights from
  `useAudioVisualizer` (live AnalyserNode) on a FrameClock-synced
  `<audio>` element. Editor / preview determinism only — deterministic
  export pre-decodes samples via the bake runtime (dispatcher wiring
  tracked separately). `themeSlots`: `color` → `palette.primary`,
  `background` → `palette.background`, `titleColor` →
  `palette.foreground`.

Sub-exports of `BarsViz` / `WaveViz` / `CircularViz` (and the
`VizProps` type) added to `audio-visualizer.tsx` so the reactive clip
can reuse the shared viz primitives.

`ALL_BRIDGE_CLIPS` now exposes 24 clips.
