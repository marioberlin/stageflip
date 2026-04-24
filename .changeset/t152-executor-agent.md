---
'@stageflip/agent': minor
---

T-152 — `@stageflip/agent` ships the Executor. `createExecutor({ provider,
registry, router })` returns an `Executor` whose `run(request, { signal?
})` yields an `AsyncIterable<ExecutorEvent>`.

Per-step flow (matches `concepts/agent-executor/SKILL.md`):
1. Construct `BundleLoader` from `@stageflip/engine`, `load()` every name
   in `step.bundles`. `BundleLoadError` → emit
   `step-end { status: 'bundle_limit_exceeded' }` and continue.
2. Call `provider.complete` with the loaded tool definitions.
3. For each `tool_use` block: emit `tool-call`, dispatch via
   `router.call(name, input, executorContext)`, drain `patchSink` +
   `applyPatch` against the working document, emit `patch-applied`, emit
   `tool-result { isError: false }`.
4. `ToolRouterError` (any kind) → emit `tool-result { isError: true }`
   with the error payload + issues; the model sees it and self-corrects.
   `kind: 'aborted'` short-circuits to `step-end { status: 'aborted' }`.
5. Append `assistant` + `user` (with tool_result blocks) messages and
   loop until the model stops calling tools or we hit
   `maxIterationsPerStep` (default 20 → `step-end { status:
   'max_iterations' }`).
6. `LLMError { kind: 'aborted' }` from the provider or a pre-start
   `signal.aborted` → `step-end { status: 'aborted' }`.

After every step: emit `step-end`. After the plan: emit
`plan-end { finalDocument }`.

Public surface:

- `createExecutor`, `Executor`, `ExecutorRequest`, `ExecutorCallOptions`,
  `CreateExecutorOptions`
- `ExecutorEvent` (discriminated by `kind`), `StepStatus`,
  `ExecutorContext`, `PatchSink`, `JsonPatchOp`
- `createPatchSink`, `DEFAULT_MAX_ITERATIONS_PER_STEP` (20),
  `DEFAULT_EXECUTOR_MAX_TOKENS` (4096)

`ExecutorContext` extends `ToolContext` with `document` (read-only
snapshot), `patchSink` (handlers `push` / `pushAll`), and `stepId`.
Handlers mutate the document by pushing JSON-Patch ops; the Executor
drains + applies them after each call and emits `patch-applied`.
Patch-apply failures surface as `is_error: true` tool_results without
mutating the document.

10 unit tests covering every happy path + safety valve + error-retry
loop + multi-step doc-threading + all four `step-end` statuses. 96%
overall line coverage on the agent package.

Deps: `fast-json-patch` 3.1.1 (MIT, already used in editor-shell; net new
to agent). Skill `concepts/agent-executor/SKILL.md` flipped to shipped.

Unblocks T-153 (Validator) and the AI-copilot wiring in
`apps/stageflip-slide/src/app/api/agent/execute/` (Phase 7 closing step).
