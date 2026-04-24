---
'@stageflip/engine': minor
'@stageflip/agent': minor
---

T-156 — Second handler bundle shipped: `create-mutate` (8 tools). First
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
