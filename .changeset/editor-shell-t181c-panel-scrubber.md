---
"@stageflip/editor-shell": minor
---

T-181c: scrubber state + playhead + `<TimelinePanel>` composition.

Completes T-181's editor-shell surface so the video app (T-187) can
render a working multi-track timeline without rebuilding pointer
plumbing:

- **`useScrubber`** — owns `currentFrame` + `dragging`, plus an
  `onPointerDown` handler that seeks on pointerdown and follows the
  cursor via document `pointermove`/`pointerup`. Clamps to
  `[0, durationFrames]`, snaps to `snapFrames`, ignores non-left
  buttons.
- **`<Playhead>`** — vertical line positioned at
  `frameToPx(currentFrame)`. `pointer-events: none` by default so
  track clicks pass through.
- **`<TimelinePanel>`** — layout shell that stacks a ruler row
  (pointer surface for `useScrubber`), a body for host tracks, and
  the playhead. Forwards `rulerProps` + `onRulerPointerDown`; panel
  width matches composition duration.

Tests: +15 (7 scrubber + 8 panel/playhead) on top of T-181b's suite.
Editor-shell total: 325/325 green. Still zero opinionated CSS —
hosts style via `className`/`style`/`data-*`/CSS custom properties.
