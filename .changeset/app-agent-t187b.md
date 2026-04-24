---
"@stageflip/app-agent": minor
"@stageflip/app-slide": patch
---

T-187b: lift slide-app orchestrator into `@stageflip/app-agent`.

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
} from '@stageflip/app-agent';
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
