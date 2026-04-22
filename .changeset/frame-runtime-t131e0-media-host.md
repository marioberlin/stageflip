---
'@stageflip/frame-runtime': minor
---

T-131e.0 — new `<FrameVideo>` / `<FrameAudio>` / `<FrameImage>`
wrappers in `@stageflip/frame-runtime/media-host`. Video + audio
wrappers delegate playback-clock sync to the existing `useMediaSync`
hook; the image wrapper is a window-gated mount (no `.currentTime`
on `<img>`, animated GIFs advance at browser pace — frame-accurate
GIF seek belongs in the bake runtime). Prerequisite for the T-131e
bake-tier clip ports (video-background, gif-player, voiceover-
narration, audio-visualizer-reactive) and side-unblocks T-131f.4
(audio-visualizer real-audio variant).
