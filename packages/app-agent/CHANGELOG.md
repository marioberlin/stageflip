# @stageflip/app-agent

## 0.1.0

### Minor Changes

- 3711af9: T-187b: lift slide-app orchestrator into `@stageflip/app-agent`.

  Moves the Phase-7 Planner/Executor/Validator wiring out of
  `apps/stageflip-slide/src/app/api/agent/execute/` and into a new
  workspace package so every editor app (slide, video, display) loads
  the same 15-bundle registry + runs the same pipeline without
  duplicating the orchestration code.

  Public surface:

  ```ts
  import {
    OrchestratorNotConfigured,
    buildProviderFromEnv,
    createOrchestrator,
    runAgent,
    type OrchestratorDeps,
    type RunAgentRequest,
    type RunAgentResult,
  } from "@stageflip/app-agent";
  ```

  Behaviour is unchanged — the slide-app's existing 4 orchestrator tests
  move with the code and continue to assert "all 15 bundles registered",
  "triad factories wired", and env-based provider construction with the
  `OrchestratorNotConfigured` sentinel.

  Slide app changes:
  - Deletes the local `orchestrator.ts` + `orchestrator.test.ts`.
  - `route.ts` imports `OrchestratorNotConfigured` + `runAgent` from
    `@stageflip/app-agent` instead of the deleted module.
  - `next.config.mjs` adds `@stageflip/app-agent` to `transpilePackages`.
  - `package.json` declares `@stageflip/app-agent` as a dep.

  Scope note: T-187c will wire the shared orchestrator into the video
  app's (`apps/stageflip-video`) `/api/agent/execute` route. The route
  is still 501 stubbed today.

- 919af67: T-206: `display-mode` engine bundle — 16th canonical bundle, two
  display-profile-specific agent tools.
  - `optimize_for_file_size` — plan which pre-pack optimisation passes
    (unused-CSS strip, JS minify, image optimizer) to enable for a
    display banner given a target ZIP size in KB. Returns a
    recommendation list sorted by expected savings. Defaults `targetKb`
    to `DisplayContent.budget.totalZipKb`, then to the IAB 150 KB
    baseline. Does not mutate the document; the Executor threads the
    recommendations into `optimizeHtmlBundle` (T-205).
  - `preview_at_sizes` — resolve per-size preview specs for a display
    banner. Falls back to `DisplayContent.sizes` when `input.sizes` is
    absent; returns `{ sizeId, width, height, durationMs }` per size —
    consumed by the editor multi-size canvas grid (T-201) and the
    display app (T-207).

  Both gate on `doc.content.mode === 'display'`; in any other mode the
  tools return `{ ok: false, reason: 'wrong_mode' }`.

  **Drift-gate bumps** — `CANONICAL_BUNDLES` grows from 15 → 16,
  `DISPLAY_MODE_BUNDLE_NAME = 'display-mode'` is added to the engine
  barrel, the shared `@stageflip/app-agent` orchestrator wires the new
  `registerDisplayModeBundle`, and `scripts/gen-tool-skills.ts`
  `OWNER_TASK_MAP` maps `'display-mode' → 'T-206'` so the per-bundle
  SKILL is auto-generated. Count assertions bumped in
  `packages/engine/src/bundles/registry.test.ts` and
  `packages/app-agent/src/orchestrator.test.ts`.

  Follow-up: `skills/stageflip/tools/display-mode/SKILL.md` is generated
  (15 tool-skill files → 16). `gen-tool-skills:check` PASS.

  15 new tests (8 register-drift + 7 handler behaviour); 0 new runtime
  deps.

### Patch Changes

- Updated dependencies [fa7bd86]
- Updated dependencies [919af67]
- Updated dependencies [58d78e7]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [b8808c7]
- Updated dependencies [2b06f13]
- Updated dependencies [3457c83]
- Updated dependencies [b1a5501]
- Updated dependencies [39a7adf]
- Updated dependencies [f8b47f0]
- Updated dependencies [10ae733]
- Updated dependencies [822826e]
- Updated dependencies [e69465d]
- Updated dependencies [db8df77]
- Updated dependencies [8dd5df9]
- Updated dependencies [3140b2d]
- Updated dependencies [724650d]
- Updated dependencies [ceec209]
- Updated dependencies [4aed082]
- Updated dependencies [980b019]
- Updated dependencies [ca340c5]
- Updated dependencies [a7e9fec]
- Updated dependencies [a1cf600]
- Updated dependencies [d0e7076]
- Updated dependencies [1a684b1]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/engine@0.1.0
  - @stageflip/llm-abstraction@0.1.0
  - @stageflip/schema@0.1.0
  - @stageflip/agent@0.1.0
