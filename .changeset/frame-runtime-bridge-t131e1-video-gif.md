---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

T-131e.1 — video / image tranche lands on the frame-runtime bridge.
Two new clips ported from SlideMotion reference against the
`<FrameVideo>` / `<FrameImage>` surface from T-131e.0:

- `video-background` — full-bleed muted `<FrameVideo>` with timed
  title + subtitle overlay. `themeSlots`: `titleColor` →
  `palette.foreground`, `subtitleColor` → `palette.secondary`.
- `gif-player` — fade + scale entrance around an `<img>` (via
  `<FrameImage>`). GIF frame advance stays browser-controlled in
  the preview path; deterministic export decodes via the bake
  runtime (dispatcher wiring tracked separately). `themeSlots`:
  `backgroundColor` → `palette.background`, `titleColor` →
  `palette.foreground`.

`ALL_BRIDGE_CLIPS` now exposes 22 clips.
