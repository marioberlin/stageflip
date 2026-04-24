---
title: Tools — Timing Bundle
id: skills/stageflip/tools/timing
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-157
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
---

# Tools — Timing Bundle

Four write-tier tools for per-slide duration + transition control. Slide-
mode only. Handlers type against `MutationContext`; mutation flows
through `ctx.patchSink.push(op)`.

Registration: `registerTimingBundle(registry, router)` from
`@stageflip/engine`.

Every response shape is a discriminated union on `ok`. Failure `reason`s
are `wrong_mode` (non-slide document) or `not_found` (unknown slide id);
handlers never throw.

## Tools

### `set_slide_duration` — `{ slideId, durationMs }`

Set a slide's static duration in ms. Positive integer. Emits `add` when
the field was absent, `replace` otherwise. Returns `{ ok: true, slideId,
durationMs }`.

### `clear_slide_duration` — `{ slideId }`

Remove `durationMs`, reverting the slide to "advance on user click". When
the field was already absent, returns `{ ok: true, wasSet: false }` with
no patch emitted.

### `set_slide_transition` — `{ slideId, kind, durationMs? }`

Set the slide's entrance transition. `kind` ∈ `none` / `fade` /
`slide-left` / `slide-right` / `zoom` / `push`. `durationMs` defaults to
400 (schema default). Emits `add` / `replace` as appropriate.

### `clear_slide_transition` — `{ slideId }`

Remove the slide's transition. Same `wasSet` pattern as
`clear_slide_duration`.

## Invariants

- Every handler declares `bundle: 'timing'`.
- All 4 handlers type against `MutationContext`; Executor's
  `ExecutorContext` satisfies it.
- Tool count 4 → well within the 30-tool I-9 budget.
- `clear_*` handlers are idempotent: calling twice is safe; the second
  call returns `wasSet: false` with no patch.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Router: `concepts/tool-router/SKILL.md`
- Executor (consumer): `concepts/agent-executor/SKILL.md`
- Sibling (slide + element CRUD): `tools/create-mutate/SKILL.md`
- Task: T-157
