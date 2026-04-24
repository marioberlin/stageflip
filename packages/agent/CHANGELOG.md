# @stageflip/agent

## 0.1.0

### Minor Changes

- 2b06f13: T-151 — `@stageflip/agent` ships the Planner agent. `createPlanner({ provider })`
  returns a `Planner` whose `plan({ prompt, document?, model, bundles?, maxTokens?, temperature? }, { signal? })`
  method:

  - Builds a system prompt listing the 14 canonical tool bundles (seeded
    from the tool-bundles skill; T-151a will swap the stub registry for a
    real one driven by `skills/stageflip/tools/<bundle>/SKILL.md`).
  - Calls `provider.complete(...)` from `@stageflip/llm-abstraction` with
    a single `emit_plan` tool whose input_schema mirrors `planSchema`.
    Forces structured output without needing a `tool_choice` extension —
    the prompt + single-tool + LLM compliance does the job.
  - Extracts the `tool_use` block, Zod-validates via `planSchema`, and
    rejects unknown bundle references (via `PlannerError`).
  - Defaults to `temperature: 0` and `max_tokens: 2048`; propagates
    `AbortSignal` through to the provider.

  Error taxonomy: `PlannerError` with `kind: 'no_tool_call' | 'invalid_plan' | 'unknown_bundle'`.

  Public exports: `Plan`, `PlanStep`, `BundleSummary`, `Planner`,
  `PlannerRequest`, `PlannerCallOptions`, `planSchema`, `planStepSchema`,
  `bundleSummarySchema`, `listBundles`, `BUNDLE_NAMES`, `buildSystemPrompt`,
  `buildUserMessages`, `EMIT_PLAN_TOOL`, `EMIT_PLAN_TOOL_NAME`,
  `createPlanner`, `PlannerError`.

  28 unit tests / 99.61% line coverage (100% on all non-barrel files). Skills
  updated: `concepts/agent-planner/SKILL.md` flipped to "shipped",
  `concepts/llm-abstraction/SKILL.md` "Current state" updated to cite T-151
  as the first live consumer. Unblocks T-152 (Executor consumes `Plan` +
  `list_bundles()` output).

- 3457c83: T-151a — `@stageflip/engine` ships the hierarchical tool-bundle loader:
  registry + loader + canonical catalog. `@stageflip/agent`'s Planner
  migrates off its stub bundle list and consumes the engine registry.

  `@stageflip/engine`:

  - `ToolBundle` / `BundleSummary` types; `summarise(bundle)` helper.
  - `BundleRegistry` class: `register(bundle)`, `mergeTools(name, tools)`
    (appends — used by T-155–T-168 handler packages), `list()` (backs the
    `list_bundles` meta-tool, returns summaries), `get(name)` (backs
    `expand_scope`, returns full bundle), `has` / `size`.
  - `createCanonicalRegistry()` — returns a fresh registry seeded with the
    14 canonical bundles from `CANONICAL_BUNDLES`. Each call is independent;
    mutations do not leak between instances.
  - `BundleLoader` — stateful per-Executor-step context. `load(name)` is
    the `load_bundle` meta-tool. Refuses with `BundleLoadError` on
    `unknown_bundle`, `already_loaded`, or `limit_exceeded`. Default cap
    `DEFAULT_TOOL_LIMIT = 30` (invariant I-9). `reset()` clears between
    steps; `toolDefinitions()` flattens to the exact `LLMToolDefinition[]`
    the Executor passes to the LLM.
  - Canonical tool arrays are empty today — T-155–T-168 populate them via
    `registry.mergeTools(name, handlerTools)` from handler packages. The
    Planner sees the catalog irrespective of handler readiness.

  `@stageflip/agent`:

  - Drops the `packages/agent/src/planner/bundles.ts` stub.
  - `createPlanner({ provider, registry? })` — `registry` defaults to
    `createCanonicalRegistry()`; override for mode-specific scoping.
  - `PlannerRequest.bundles?` still overrides per-request.
  - Barrel re-exports the registry + loader APIs from `@stageflip/engine`
    so consumers stay on one import root.

  Tests: 19 engine tests (loader + registry + types) at 100% line coverage
  on every non-barrel file; 25 agent tests (post-migration; bundles tests
  moved to engine). All 9 gates green.

  Unblocks T-152 (Executor constructs a `BundleLoader` per plan step and
  passes `toolDefinitions()` to the LLM) and T-155–T-168 (handler packages
  populate bundles via `mergeTools`).

- b1a5501: T-152 — `@stageflip/agent` ships the Executor. `createExecutor({ provider,
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

- 39a7adf: T-153 — `@stageflip/agent` ships the Validator, the third of the
  three-agent triad. `createValidator({ provider, extraProgrammaticChecks? })`
  returns a `Validator` whose `validate(request, { signal? })` yields a
  `ValidationResult`.

  Honours the skill's core boundary: **quality tier is set
  programmatically, never by LLM**.

  - **Built-in programmatic check**: `schema_round_trip` — the document
    must `documentSchema.parse` cleanly AND re-serialise + re-parse
    byte-for-byte. Catches Executor-side patches that produce a shape
    the schema silently accepts but the serializer can't round-trip.
  - **`extraProgrammaticChecks` hook** for T-104's pre-render linter and
    T-100's parity PSNR/SSIM to plug in. Both are currently render-aware
    and live outside agent, so the Validator stays render-agnostic.
  - **Three qualitative checks** opt-in by name on the request:
    `brand_voice` / `claim_plausibility` / `reading_level`. Each is one
    provider.complete call with a forced `emit_qualitative_verdict` tool;
    Zod-validated `{ verdict, evidence, suggestedFix? }` payload.
  - **Tier**: any programmatic `fail` → `fail`; else any qualitative
    `suggestedFix` → `pass-with-notes`; else `pass`. `required_fixes`
    aggregates every `suggestedFix` (still populated under `fail`).
  - **Errors**: `QualitativeCheckError` with `kind: 'no_tool_call' |
'invalid_verdict'`. Programmatic checks that throw are captured as
    `status: 'fail'` so a broken check cannot panic the run.
  - **Abort** between qualitative checks is supported; already-completed
    checks remain in the result.

  Public surface: `createValidator`, `Validator`, `ValidatorRequest`,
  `ValidatorCallOptions`, `CreateValidatorOptions`, `ValidationResult`,
  `ValidationTier`, `ProgrammaticCheck`/`ProgrammaticCheckResult`,
  `QualitativeCheckName`/`QualitativeCheckResult`,
  `DEFAULT_PROGRAMMATIC_CHECKS`, `runProgrammaticChecks`,
  `schemaRoundTripCheck`, `QUALITATIVE_CHECKS`,
  `EMIT_QUALITATIVE_VERDICT_TOOL(_NAME)`, `runQualitativeCheck`,
  `QualitativeCheckError`, `qualitativeToolInputSchema`,
  `validationResultSchema`.

  21 new tests (5 programmatic + 10 qualitative + 6 validator). 64 total
  agent tests; 93% line coverage on validator modules. All 9 gates green.
  Skill `concepts/agent-validator/SKILL.md` flipped to the shipped
  contract, including the tier rule and the extraProgrammaticChecks plug
  points for T-104/T-100.

  Phase 7's three-agent triad (Planner T-151 + Executor T-152 + Validator
  T-153) now ships end-to-end. T-170 is the remaining copilot-wiring step
  for the editor; T-155–T-168 populate real handlers.

- 10ae733: T-155 — First handler bundle shipped: `read` (5 tools). Establishes the
  handler-package pattern T-156–T-168 follow.

  `@stageflip/engine` additions:

  - **`DocumentContext` / `DocumentSelection`** — exported from the router
    types. Every read-tier handler accepts this context (document +
    optional selection); handlers that mutate the doc declare a wider
    context type (like `ExecutorContext`) that extends it.
  - **5 `read` bundle handlers** in `packages/engine/src/handlers/read/`:
    - `get_document` → metadata + mode-specific count (slides / tracks /
      sizes). Never returns the full document.
    - `get_slide` → per-slide summary (element count, duration flags,
      bg/transition/notes presence). Slide-mode only; wrong-mode +
      not-found cases return `{ found: false, reason }`.
    - `list_elements` → `{ id, type, name?, visible }[]` for a slide.
    - `describe_selection` → selected element summaries keyed on
      `context.selection`. Empty arrays when nothing is selected.
    - `get_theme` → palette + tokens. Palette entries that are not plain
      colour strings are dropped rather than passed through.
  - **`registerReadBundle(registry, router)`** — one-call population:
    merges the 5 `LLMToolDefinition`s onto the registry's `read` bundle
    and registers the 5 handlers onto the router. Router/registry name
    set asserted equal by an integration test (drift gate). Refuses when
    the registry has no `read` bundle or the router already has a matching
    name.

  `@stageflip/agent`:

  - `ExecutorContext` now extends `DocumentContext` — deduplicates the
    `document` + `selection` fields. Agent still owns `patchSink` +
    `stepId`.
  - `ExecutorRequest.selection?: DocumentSelection` threads editor-side
    selection through to every handler (`describe_selection` reads it).

  21 new engine tests (14 handlers + 7 register). Total engine tests: 57.
  All 9 gates green.

  Skill updates:

  - `skills/stageflip/tools/read/SKILL.md` flipped from placeholder to
    the shipped per-tool contract.
  - `skills/stageflip/concepts/tool-bundles/SKILL.md` → related list
    extended to include tool-router.

  Unblocks T-156 (create-mutate bundle) and T-170 (wire orchestrator into
  the AI copilot; the Executor can now answer `describe_selection` from
  real editor state).

- 822826e: T-156 — Second handler bundle shipped: `create-mutate` (8 tools). First
  write-tier bundle; establishes the `MutationContext` pattern T-157–T-168
  write-tier bundles follow.

  `@stageflip/engine` additions:

  - **`PatchSink` / `MutationContext` / `JsonPatchOp`** exported from
    router types. `MutationContext extends DocumentContext` with a
    `patchSink` handle; handlers push JSON-Patch ops that the Executor
    drains + applies between tool calls.
  - **8 `create-mutate` handlers**: `add_slide`, `update_slide`,
    `duplicate_slide`, `reorder_slides`, `delete_slide`, `add_element`,
    `update_element`, `delete_element`. Every output is a discriminated
    union on `ok`; failure branches carry `reason` (`wrong_mode` /
    `not_found` / `last_slide` / `mismatched_ids` / `mismatched_count` /
    `rejected_fields`). Handlers never throw for caller-controllable
    errors.
  - **Deterministic id generation**: `nextSlideId(doc)` / `nextElementId(doc)`
    scan existing ids and pick the next free integer suffix. Between
    tool calls the Executor re-reads the document, so successive
    `add_slide` calls in one step get sequential ids.
  - **`registerCreateMutateBundle(registry, router)`** one-call population.
    Drift-gate test asserts the router↔registry name sets agree.

  `@stageflip/agent`:

  - `ExecutorContext` now `extends MutationContext` — aligns the
    patchSink shape with engine's contract. Agent's `PatchSink` extends
    engine's with `drain()` + `size` for the Executor's batch-apply
    loop.
  - `JsonPatchOp` now re-exported from engine (previously aliased from
    fast-json-patch). The loose engine shape is the canonical type;
    Executor casts when calling `applyPatch`.

  Tests: 24 new engine tests (18 handlers + 6 register); 82 total engine
  tests. All 9 gates green.

  Skill `tools/create-mutate/SKILL.md` flipped from placeholder to the
  shipped per-tool contract.

  Unblocks T-157+ (timing / layout / validate / ...) — every write-tier
  bundle consumes `MutationContext` + uses the same register pattern.

### Patch Changes

- Updated dependencies [fa7bd86]
- Updated dependencies [919af67]
- Updated dependencies [b8808c7]
- Updated dependencies [3457c83]
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
  - @stageflip/engine@0.1.0
  - @stageflip/llm-abstraction@0.1.0
  - @stageflip/schema@0.1.0
