---
"@stageflip/editor-shell": minor
---

T-181 (scoped): shared timeline math + multi-track layout primitives.

Hoists frame↔pixel math (formerly owned by `apps/stageflip-slide`'s
T-126 timeline) into `@stageflip/editor-shell` so video, display, and
future modes all consume the same logic:

- **Math** — `frameToPx`, `pxToFrame`, `snapFrame`, `rulerTickFrames`,
  `formatFrameLabel`, `TimelineScale`. Ported verbatim; slide app's
  local `timeline-math.ts` is now a re-export of these symbols.
- **Tracks** — new `trackRowLayout`, `placeElementBlock`,
  `placeTrackElements`, `totalTrackStackHeight`. Canonical top-to-bottom
  order is `visual` / `overlay` / `caption` / `audio` with per-kind
  heights; blocks are clipped to `[0, durationFrames)`; out-of-range
  blocks are filtered.

Scope note: T-181 React components (panel, ruler, track rows) ship in
follow-up PRs. This PR is pure math + layout types so the downstream UI
work has a deterministic foundation.
