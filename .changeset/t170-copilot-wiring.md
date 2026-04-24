---
'@stageflip/app-slide': minor
---

T-170 — Copilot wiring. `/api/agent/execute` now runs the real
Planner → Executor → Validator triad instead of returning the Phase-6
501 stub. The orchestrator module
(`src/app/api/agent/execute/orchestrator.ts`) populates a registry with
all 14 handler bundles + shared `ToolRouter<ExecutorContext>`, then
calls the triad in sequence.

Environment handling:

- `ANTHROPIC_API_KEY` is read from `process.env` at request time.
- Missing key → 503 response with `error: 'not_configured'`
  (distinct from the legacy 501 `phase-7` sentinel, which is preserved
  in the client wrapper for backwards compat with any still-deployed
  pre-T-170 builds).

Request contract (Zod-validated, `.strict()`):

- `prompt: string (1-4000)` — required
- `document: Document` — required; Zod-validated against
  `documentSchema`
- `selection?` — optional editor selection
- `plannerModel` / `executorModel` / `validatorModel` — optional
  overrides, default to `claude-sonnet-4-6`

Response shape on success (200):

- `ok: true, plan, events[], finalDocument, validation`

`executeAgent` client wrapper updated: new `kind: 'applied'` result
carries the full `payload`; `kind: 'not_configured'` flags the 503
case; legacy `kind: 'pending'` (501) path retained.

6 new app tests (4 orchestrator + 2 refreshed execute-agent); 320 total
app tests. Phase 7 now end-to-end: a Claude user with a configured API
key can POST to `/api/agent/execute` and receive a real multi-step
plan + executed patches + validation verdict.
