---
"@stageflip/app-slide": minor
---

T-123d: `<SlidePlayer>` — frame-driven slide preview via `@stageflip/frame-runtime`.

Fourth and final row split from T-123 (CanvasWorkspace port). Closes
the CanvasWorkspace tier.

**`<SlidePlayer>`** replaces the Remotion-based `SingleSlidePreview`
/ `PlayerPreview` from the SlideMotion reference. Zero Remotion
imports — animation math runs through `@stageflip/frame-runtime`
(`interpolate`, `EASINGS`, `FrameProvider`, `VideoConfig`).

Features:

- Renders each element at its per-frame transform. `absolute` timing
  + `fade` animations with every named easing the runtime ships;
  other timing / animation kinds pass through unchanged (placeholder
  until the full compile pipeline arrives).
- Drives a `<FrameProvider>` over the element tree so downstream
  clips / runtimes can `useCurrentFrame()`.
- `playing` prop enables `requestAnimationFrame`-driven playback; a
  `cancelled` flag + `cancelAnimationFrame` guarantee clean teardown
  on unmount.
- `currentFrame` + `onFrameChange` props let T-126 (timeline) scrub
  externally.
- Exports `applyAnimationsAtFrame(element, frame, fps)` so tests and
  tooling can introspect the snapshot without mounting React.

**App integration:** header gets a mode toggle (Edit ↔ Preview). In
preview mode, `<SlideCanvas>` unmounts and `<SlidePlayer>` renders
the active slide at frame 0 ready for T-126's timeline to drive.

**Tests:** 10 vitest cases (fade math, scrub mode, rAF playback with
a stubbed queue) + 1 e2e asserting the toggle swaps the surfaces.
No new external deps.

Runtime dep added: `@stageflip/frame-runtime` (workspace).
