---
'@stageflip/engine': minor
'@stageflip/agent': minor
---

T-155 — First handler bundle shipped: `read` (5 tools). Establishes the
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
