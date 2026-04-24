# @stageflip/app-video

## 0.1.0

### Minor Changes

- f772e9d: T-187a: walking skeleton for `apps/stageflip-video`.

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

### Patch Changes

- 6df03f4: T-187c: wire the shared `@stageflip/app-agent` orchestrator into the
  video app's `/api/agent/execute` route.

  Replaces the walking-skeleton 501 stub from T-187a with the real
  Planner → Executor → Validator pipeline, mirroring `apps/stageflip-slide`'s
  contract verbatim:

  - **Zod-validated strict body**: `prompt` (1–4000 chars), `document`
    (`documentSchema`), optional `selection` / model overrides.
  - **200 `{ ok: true, plan, events, finalDocument, validation }`** on
    successful orchestration.
  - **400 `invalid_json`** when the body isn't valid JSON.
  - **400 `invalid_request`** when the body fails schema validation.
  - **503 `not_configured`** when `ANTHROPIC_API_KEY` is unset.
  - **500 `orchestrator_failed`** on any other error.
  - **405 `method_not_allowed`** on `GET`.

  Wiring:

  - `@stageflip/app-agent` + `zod` added as deps.
  - `next.config.mjs` transpiles `@stageflip/app-agent`.
  - New `route.test.ts` pins the 400/405/503 branches (node-env,
    happy-path orchestration is covered by app-agent's own smoke tests).
  - `test` script now runs vitest without `--passWithNoTests`.

  Video app tests: 8/8 (4 editor shell + 4 route). T-187 completes.

- Updated dependencies [3711af9]
- Updated dependencies [6019f5f]
- Updated dependencies [e0054c4]
- Updated dependencies [05f5aa9]
- Updated dependencies [d49e5dd]
- Updated dependencies [d062bc1]
- Updated dependencies [ce146db]
- Updated dependencies [d13c772]
- Updated dependencies [c126eba]
- Updated dependencies [753b22a]
- Updated dependencies [a518ed6]
- Updated dependencies [5548212]
- Updated dependencies [cd2fba6]
- Updated dependencies [6c44323]
- Updated dependencies [a146bd2]
- Updated dependencies [62db960]
- Updated dependencies [c0eed61]
- Updated dependencies [7ddf9ad]
- Updated dependencies [fa7bd86]
- Updated dependencies [919af67]
- Updated dependencies [aedcaca]
- Updated dependencies [63bfef6]
- Updated dependencies [d017704]
- Updated dependencies [85d632a]
- Updated dependencies [0df802a]
- Updated dependencies [36d0c5d]
  - @stageflip/app-agent@0.1.0
  - @stageflip/editor-shell@0.1.0
  - @stageflip/profiles-video@0.1.0
  - @stageflip/schema@0.1.0
