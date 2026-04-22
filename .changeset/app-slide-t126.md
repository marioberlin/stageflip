---
"@stageflip/app-slide": minor
---

T-126: `<TimelinePanel>` — ruler, tracks, scrubber, and pixel-math helpers.

Ports the Remotion-free equivalent of the SlideMotion timeline from
`reference/.../timeline/`.

- **`timeline-math.ts`** — pure pixel/frame conversion + snap + ruler
  tick spacing + label formatter. Keeps the components dumb and
  deterministic; tests live in the math file, not in the components.
- **`<TimelinePanel>`** — controlled wrapper (audit §2 calls this the
  cleanest port: no atom subscriptions, parent drives `currentFrame`
  + `onCurrentFrameChange`). Lays out:
  - `Ruler` — tick marks + second labels. Tick density auto-adapts to
    the current zoom via `rulerTickFrames`.
  - `Track` per element — name label + timing block per animation.
    `absolute` timings render a sized gradient block; other kinds
    render a striped placeholder with `data-timing-kind` preserved
    so reviewers can tell the compile pass isn't wired yet.
  - `Scrubber` — vertical `#5af8fb` playhead; hit-area above the
    ruler captures pointer-down + pointer-move to drive the parent
    scrub callback. Clamps to `[0, durationInFrames - 1]` and
    accounts for `scrollLeft` so the math works after the user pans
    the timeline.
  - Readout — frame number + humanized seconds (`0.5s`, `1s`,
    `2.5s`) under the scroll area.
- **App integration** — `editor-app-client.tsx` threads a single
  `currentFrame` state through both `<SlidePlayer>` (preview mode)
  and `<TimelinePanel>` (visible in both modes). Scrubbing the
  timeline drives the player; `SlidePlayer.onFrameChange` feeds back
  into the same state so pause leaves the scrubber at the rAF-
  advanced position.

22 new vitest cases (14 math, 8 panel) + 1 new e2e test; 77 app tests
+ 7 e2e total, all green. All 11 CI gates clean.
