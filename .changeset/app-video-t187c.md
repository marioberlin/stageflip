---
"@stageflip/app-video": patch
---

T-187c: wire the shared `@stageflip/app-agent` orchestrator into the
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
