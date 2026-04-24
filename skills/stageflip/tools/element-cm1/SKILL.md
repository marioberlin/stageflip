---
title: Tools — Element CM1 Bundle
id: skills/stageflip/tools/element-cm1
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-161
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
  - skills/stageflip/tools/layout/SKILL.md
  - skills/stageflip/tools/clip-animation/SKILL.md
---

# Tools — Element CM1 Bundle

Twelve write-tier tools for per-element content mutation. Slide-mode
only. Handlers type against `MutationContext`; mutations flow as
JSON-Patch ops via `ctx.patchSink.push(op)`. Between tool calls the
Executor drains + applies + re-reads, so chained element edits in one
plan step see the previous mutation.

Scope boundary:

- `create-mutate` (T-156) owns slide/element CRUD (add / delete /
  reorder at the collection level).
- `layout` (T-158) owns geometry (transform / alignment / sizing).
- `clip-animation` (T-160) owns clip props + animations.
- `table-cm1` (T-163) owns table row/column/cell edits — **not**
  touched here. Table elements are the only element type this bundle
  does not operate on.

Registration: `registerElementCm1Bundle(registry, router)` from
`@stageflip/engine`.

Every response is a discriminated union on `ok`. Type-specific tools
refuse with `wrong_element_type` (matches `wrong_animation_kind` /
`not_a_clip` naming from sibling bundles) when the element's
discriminant doesn't match the tool's target.

## Tools

### Text

#### `set_text_content` — `{ slideId, elementId, text?, runs? }`

Replace `text` (plain string), `runs` (styled segments), or both. At
least one must be supplied (Zod `refine`). `runs` is wholesale-replaced
— use `append_text_run` / `remove_text_run` for incremental edits.

#### `append_text_run` — `{ slideId, elementId, run, position? }`

Insert a single styled run. If `runs` is absent, creates the array with
one element. `position` defaults to end.

#### `remove_text_run` — `{ slideId, elementId, index }`

Remove by zero-based index. `run_not_found` if out of range or `runs`
absent.

#### `update_text_run_style` — `{ slideId, elementId, index, style }`

Partial-merge into a run's fields: `color` / `weight` / `italic` /
`underline` / `text`. Each non-undefined field is one `add` or `replace`
based on current run state.

### Block-level text

#### `update_text_style` — `{ slideId, elementId, fontFamily?, fontSize?, color?, align?, lineHeight? }`

Partial-merge block-level styles on a text element.

### Per-type

#### `update_shape` — `{ slideId, elementId, shape?, path?, fill?, stroke?, cornerRadius? }`

Partial-merge into a shape element. `stroke` is replaced wholesale.
Custom-path validation (path required for `shape='custom-path'`) lives
at RIR compile time, not here.

#### `update_image` — `{ slideId, elementId, src?, alt?, fit? }`

Empty-string `alt` removes the field (matches `update_slide`'s
empty-string handling in T-156).

#### `update_video` — `{ slideId, elementId, src?, trim?, muted?, loop?, playbackRate? }`

`trim` validated against `trimWindowSchema` (`endMs > startMs`).

#### `update_audio` — `{ slideId, elementId, src?, trim?, mix?, loop? }`

`mix` is **merged field-by-field** into any existing `mix` object — the
only per-type tool with sub-object merge semantics, because audio mix is
a natural partial edit target. When `mix` is absent, the patch seeds a
fresh object.

#### `update_code` — `{ slideId, elementId, code?, language?, theme?, showLineNumbers?, wrap? }`

Empty-string `theme` removes the field.

#### `update_embed` — `{ slideId, elementId, src?, sandbox?, allowFullscreen? }`

`sandbox` is replaced wholesale.

### Common

#### `set_element_flags` — `{ slideId, elementId, visible?, locked?, name? }`

Type-agnostic — works on any element. Empty-string `name` removes the
field.

## Invariants

- Every handler declares `bundle: 'element-cm1'`.
- All 12 handlers type against `MutationContext`; Executor's
  `ExecutorContext` satisfies it.
- Tool count 12 → well within I-9's 30 cap.
- Type-specific tools always refuse `wrong_element_type` when the
  element discriminant doesn't match the tool's target — no silent
  "edit a shape as if it were text".
- Handlers mutate via patches only.
- Table elements are out-of-scope — use `table-cm1` (T-163).

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Sibling: `tools/create-mutate/SKILL.md`, `tools/layout/SKILL.md`,
  `tools/clip-animation/SKILL.md`
- Task: T-161
