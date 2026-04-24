---
'@stageflip/agent': minor
---

T-151 — `@stageflip/agent` ships the Planner agent. `createPlanner({ provider })`
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
