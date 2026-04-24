---
"@stageflip/app-video": minor
---

T-187a: walking skeleton for `apps/stageflip-video`.

- Next.js 15.5 App Router scaffold (tsconfig, `next.config.mjs`, layout,
  `globals.css`) on port 3200. Mirrors `apps/stageflip-slide`'s T-122
  pattern: transpile workspace packages, disable the LGPL sharp
  optimizer.
- Root page mounts `<EditorShell>` with a seeded video document (one
  visual + one audio + one caption track; 30s, 16:9, 30fps) and renders
  a minimal track-list view so the app has something to show while
  T-187b wires the real multi-track timeline panel (T-181 primitives
  already merged) + aspect-ratio bouncer preview (T-182).
- `/api/agent/execute` stubs the Phase-8 agent route: `POST` returns a
  structured 501 with `{ error: 'not_implemented', phase: 'phase-8' }`;
  `GET` returns 405. Gives follow-up PRs a stable URL to aim at.
- Vitest + happy-dom smoke spec asserting the shell mounts, reports
  `mode: video`, and renders one row per seeded track.

Scope note: T-187b lifts the slide-app orchestrator into a shared
`app-agent` module so the video app can reuse Planner/Executor/
Validator without duplicating wiring. T-187c plugs the real
`<TimelinePanel>` + `<AspectRatioGrid>` into this shell.
