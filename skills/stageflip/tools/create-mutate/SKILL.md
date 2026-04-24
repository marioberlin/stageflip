---
title: Tools — Create/Mutate Bundle
id: skills/stageflip/tools/create-mutate
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-156
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/tools/read/SKILL.md
---

# Tools — Create/Mutate Bundle

Eight write-tier tools for slide + element CRUD in a slide-mode document.
Handlers type against `MutationContext` (doc + patch sink + optional
selection); every mutation flows through `ctx.patchSink.push(op)` as a
JSON-Patch op. The Executor drains the sink + applies patches + re-reads
the document between tool calls, so successive calls in one plan step
see the previous mutation's effect.

Registration: `registerCreateMutateBundle(registry, router)` from
`@stageflip/engine`.

Every response shape is a discriminated union on `ok` — success branches
carry ids + counts; failure branches carry `reason` (`wrong_mode` /
`not_found` / `last_slide` / `mismatched_ids` / `mismatched_count` /
`rejected_fields`). Handlers never throw for caller-controllable errors;
the router's `input_invalid` still gates Zod-level failures.

## Tools

### `add_slide` — `{ position?, title?, durationMs?, notes?, background? }`

Append or insert a new slide. Position defaults to the end. Slide id is
auto-generated (`slide-<next>`). Slide-mode only.

### `update_slide` — `{ slideId, title?, durationMs?, notes?, background? }`

Update one or more fields. Empty-string `title` / `notes` emits a
`remove` op so the field goes away entirely.

### `duplicate_slide` — `{ slideId, position? }`

Deep-copy a slide. Fresh slide id; every element gets a fresh id so the
deck stays unique-id. Insert position defaults to immediately after the
source.

### `reorder_slides` — `{ order: string[] }`

Replace the slide order. `order` must contain every existing slide id
exactly once (`mismatched_count` / `mismatched_ids` otherwise). Emits a
single `replace` op on `/content/slides`.

### `delete_slide` — `{ slideId }`

Remove a slide. Refuses to delete the last remaining one (`last_slide`)
— every deck must have at least one slide (schema invariant).

### `add_element` — `{ slideId, element, position? }`

Append or insert an element. Caller supplies the full element payload
(Zod-validated via `elementSchema`). If the element's id collides with
an existing element anywhere in the deck, a fresh id is assigned
automatically.

### `update_element` — `{ slideId, elementId, updates }`

Replace one or more fields on an element. `id` and `type` are rejected
(`rejected_fields`) — use delete + add for those. Updates are per-field
`replace` ops; no merge logic. Text-run editing is element-cm1 (T-161)'s
job, not this bundle's.

### `delete_element` — `{ slideId, elementId }`

Remove a single element.

## Invariants

- Every handler declares `bundle: 'create-mutate'` (tool-bundles §Enforcement).
- All 8 handlers type against `MutationContext`; Executor's
  `ExecutorContext` satisfies it.
- Tool count 8 → well within the 30-tool I-9 budget.
- Handlers mutate via patches only. They never mutate `ctx.document`
  directly; they never call the LLM; they never speak to external
  services.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Router: `concepts/tool-router/SKILL.md`
- Executor (consumer): `concepts/agent-executor/SKILL.md`
- Read tier (sibling): `tools/read/SKILL.md`
- Task: T-156
