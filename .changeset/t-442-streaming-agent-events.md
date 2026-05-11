---
'@stageflip/agent': minor
'@stageflip/app-agent': minor
'@stageflip/editor-shell': minor
---

T-442 — SSE / ReadableStream streaming transport for ExecutorEvents.

Adds a `?stream=true` branch on `POST /api/agent/execute` (slide app)
that returns `text/event-stream` instead of buffering the full Planner
→ Executor → Validator run before responding. Each `ExecutorEvent` is
emitted as it occurs, plus two transport-only events
(`validation-complete`, `plan-cancelled`).

New public surfaces:

- `@stageflip/agent`: `encodeExecutorEventAsSse`,
  `decodeExecutorEventFromSse`, `toReadableStream`, `StreamEvent`,
  `PlanCancelledEvent`, `ValidationCompleteEvent`.
- `@stageflip/app-agent`: `streamAgent` (async-iterable variant of
  `runAgent`).
- `@stageflip/editor-shell`: `consumeAgentStream`,
  `AgentStreamHandlers`.

Resolves the Phase 7 closeout carry-forward (streaming events from
`/api/agent/execute`) and unlocks T-438 placeholder→real swap delivery
via streaming (vs the prior next-agent-run polling).

Not a structural extension per CLAUDE.md §13 — `ExecutorEvent` is
unchanged; the canonical document model is unchanged; the non-streaming
JSON branch is unchanged.
