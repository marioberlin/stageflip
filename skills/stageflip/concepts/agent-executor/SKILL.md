---
title: Agent — Executor
id: skills/stageflip/concepts/agent-executor
tier: concept
status: substantive
last_updated: 2026-04-24
owner_task: T-152
related:
  - skills/stageflip/concepts/agent-planner/SKILL.md
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/concepts/llm-abstraction/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# Agent — Executor

The Executor takes a Planner's `PlanStep[]` and actually performs the work.
One step at a time, it loads the required bundles, runs a tool-call loop until
the step is complete, then moves to the next step.

## Input

- `plan: PlanStep[]`
- `document: Document` (mutable via patches)
- `abortSignal: AbortSignal`

## Output (streaming)

```ts
type ExecutorEvent =
  | { kind: 'step-start'; stepId: string }
  | { kind: 'tool-call'; stepId: string; name: string; args: unknown }
  | { kind: 'tool-result'; stepId: string; name: string; result: unknown }
  | { kind: 'patch-applied'; stepId: string; patch: JsonPatchOp[] }
  | { kind: 'step-end'; stepId: string }
  | { kind: 'plan-end'; finalDocument: Document };
```

Events stream to the editor UI (copilot sidebar) and to parity traces.

## The tool-call loop

For each step:

1. `load_bundle(b)` for each bundle in `step.bundles`. Verify ≤30 loaded
   tools (I-9); if exceeded, raise `bundle-limit-exceeded` back to Planner.
2. Call LLM with: step description, current doc state (patched), loaded
   tools.
3. LLM emits one or more tool calls. Each is Zod-validated via `tool-router`
   (T-154). Invalid input → error back to LLM, retry.
4. Tool executes. If it mutates the doc, a JSON Patch is produced and
   applied. `patch-applied` event streams.
5. LLM decides whether the step is complete. If yes, emit `step-end`. If no,
   loop to (2).

Safety valve: per-step max iterations (default 20). Exceeded → fail step,
surface to user.

## AbortController

`abortSignal` cancels mid-loop. In-flight LLM requests are cancelled; partial
patches are **not** rolled back (user's editor can undo). Stream emits a
`step-end` with `status: 'aborted'`.

## Not the Executor's job

- Quality judgments (brand voice, claim verification): Validator.
- Bundle selection: Planner.
- Parity diff: parity harness, run after Executor finishes.

## Current state (Phase 7, T-152 shipped)

`@stageflip/agent` exports `createExecutor({ provider, registry, router })`
returning an `Executor` whose `run(request, { signal? })` yields an
`AsyncIterable<ExecutorEvent>`.

- **Event stream** matches the skill's shape exactly with one addition:
  `tool-result` carries `isError: boolean` so UI consumers can style
  success vs retry-prompting failures without re-parsing the result
  payload. `step-end` carries `status: 'ok' | 'aborted' | 'max_iterations'
  | 'bundle_limit_exceeded'`.
- **Per-step flow**: construct `BundleLoader`, load every `step.bundles`
  name (catches `BundleLoadError` → `bundle_limit_exceeded`). Build
  messages, call `provider.complete` with `loader.toolDefinitions()`,
  dispatch each `tool_use` block through `router.call(name, input,
  executorContext)`. Drain `patchSink`, `applyPatch` against the working
  document, emit `patch-applied`. Append `tool_result` blocks (flagged
  `is_error: true` when the router threw) back into the messages for the
  next iteration. Loop until the model stops calling tools or we hit
  `maxIterationsPerStep` (default 20).
- **AbortController**: `signal.aborted` checks at every loop boundary;
  `LLMError(kind: 'aborted')` from the provider, `ToolRouterError(kind:
  'aborted')` from a handler, and a pre-start aborted signal all produce
  `step-end { status: 'aborted' }` cleanly. Partial patches already
  applied are kept; the UI's undo stack owns rollback.
- **Tool-input errors re-prompt**: the router throws `input_invalid`;
  the executor feeds the error payload back as a `tool_result` with
  `is_error: true` so the model can self-correct on the next iteration.
  `handler_error` + `output_invalid` follow the same re-prompt path;
  they're still "handler ran, failed" rather than bugs that abort.
- **Patch validation**: patches that fail `applyPatch` surface as an
  `is_error: true` tool_result with `error: 'patch_apply_failed'` and
  do NOT mutate the document.
- **Executor context** extends `ToolContext` with `document` (read-only
  snapshot per call), `patchSink` (`push` / `pushAll` / `drain`), and
  `stepId`. Handlers that only need the abort signal ignore the rest.


## Related

- Planner: `concepts/agent-planner/SKILL.md`
- Validator: `concepts/agent-validator/SKILL.md`
- Tool-router: T-154
