---
'@stageflip/engine': minor
---

T-154 — `@stageflip/engine` ships `ToolRouter`, the runtime half of the
agent plane. Dispatches every tool call by name with bi-directional
Zod-validated input + output.

- **`ToolHandler<TInput, TOutput, TContext>`** — `{ name, bundle,
  description, inputSchema (Zod), outputSchema (Zod), handle(input, context) }`.
  Paired with the LLM-facing `LLMToolDefinition` by shared `name`.
- **`ToolContext`** — `{ signal?: AbortSignal }` base shape. Executor (T-152)
  narrows via intersection (e.g. `{ document, patchSink, audit }`);
  handlers that only need `signal` ignore the extras.
- **`ToolRouter<TContext>.call(name, input, context)`** — validates input,
  runs handler, validates output. Throws `ToolRouterError` with `kind`:
  - `unknown_tool` — no handler registered
  - `input_invalid` — Zod rejected LLM args (Executor re-prompts with `issues`)
  - `handler_error` — handler threw a non-abort error
  - `output_invalid` — handler returned malformed data (handler bug)
  - `aborted` — `signal.aborted` before start, or handler threw `AbortError`
- **Observer hook** — `ToolRouterOptions.observer` receives `call-start` /
  `call-success` / `call-error` events for audit trail + UI streaming.
  Observer exceptions are swallowed; audit is diagnostic, not contract.
- **`.register(handler)`** throws on duplicate names; `.has / .get / .size
  / .names()` round out the inspection surface.

Router is independent of `BundleRegistry`: handler packages (T-155–T-168)
will populate both via `registry.mergeTools(name, llmDefs)` +
`router.register(handler)` from their own packages. Deriving one from the
other is a possible follow-up — out of scope here.

15 unit tests covering all five error kinds + observer + context
propagation; 100% line coverage on the router module. New concept skill
`concepts/tool-router/SKILL.md`; cross-refs on tool-bundles + agent-executor.

Unblocks T-152 (Executor constructs a router per agent run and calls
`router.call(...)` inside its tool-call loop) and T-155–T-168 (handler
packages register onto the router).
