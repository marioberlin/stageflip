---
title: Agent — Planner
id: skills/stageflip/concepts/agent-planner
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-151
related:
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/agent-validator/SKILL.md
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/llm-abstraction/SKILL.md
---

# Agent — Planner

The Planner is the first stage of the agent plane. It reads a task prompt and
the current document state, and emits a **PlanStep[]** plus the bundle set the
Executor will need.

## Input

- `prompt: string` — user intent ("make the revenue chart the focal point")
- `document: Document` — current canonical state (small — a few KB even for
  large decks; Planner may summarize for long contexts)
- `bundles: BundleSummary[]` — from `list_bundles()`; Planner does not see
  tool bodies yet

## Output

```ts
interface PlanStep {
  id: string;
  description: string;   // one line, agent-readable
  bundles: string[];     // bundle names the Executor will need for this step
  rationale?: string;    // for traceability; optional
  dependsOn?: string[];  // ids of prior steps
}
```

Plus a global "justification" field explaining how the steps add up to
completing the prompt.

## What the Planner does NOT do

- It does **not** call tools. It names bundles, not specific tools.
- It does **not** mutate the document. That is the Executor's job.
- It does **not** decide on parity thresholds or validate outputs. That is
  the Validator's job.

## Prompt scaffolding

Planner prompts are composed from:

1. Task description (system prompt)
2. Bundle catalogue (short descriptions only)
3. Current document summary
4. User prompt
5. Output schema reminder

See T-151 for the exact prompt template.

## Recovery from bad plans

If the Executor later reports `bundle-limit-exceeded` (I-9), the Planner is
re-invoked with the failing step highlighted and asked to split it. If the
Executor reports `tool-missing`, the Planner adds the appropriate bundle and
re-emits.

## Current state (Phase 7, T-151 shipped)

- `@stageflip/agent` exports `createPlanner({ provider })` → `Planner.plan({ prompt, document?, model, bundles?, maxTokens?, temperature? }, { signal? })` → `Promise<Plan>`.
- Contract enforced via `planSchema` (Zod); emission enforced via the
  `emit_plan` single-tool pattern (see `concepts/llm-abstraction/SKILL.md`).
- Bundle catalog seeded from a stub `listBundles()` returning the 14
  canonical bundles; T-151a swaps this for a real registry driven by
  `skills/stageflip/tools/<bundle>/SKILL.md`.
- Unknown bundles referenced by the LLM throw `PlannerError({ kind: 'unknown_bundle' })`.
- Default temperature 0, default max_tokens 2048.

Follow-ups tracked against T-151a / T-152:
- "Recovery from bad plans" loop (bundle-limit-exceeded / tool-missing) is the Executor's concern — this skill owns the emission contract; the retry loop lives in `concepts/agent-executor/SKILL.md`.

## Related

- Executor: `concepts/agent-executor/SKILL.md`
- Tool bundles: `concepts/tool-bundles/SKILL.md`
- Task: T-151 (planner impl), T-151a (bundle loader)
