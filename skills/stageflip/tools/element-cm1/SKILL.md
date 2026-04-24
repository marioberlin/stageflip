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
---

# Tools — Element CM1 Bundle

Element-level content-mutation tools (text, shape, image, table cells).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/element-cm1/`.

Registration: see `@stageflip/engine`'s `registerElementCm1Bundle` (or equivalent) export.

## Tools

### `set_text_content`

Replace a text element's `text` (plain string), its `runs` (styled segments), or both. Supply one or both; at least one must be present. `runs` is wholesale-replaced — use `append_text_run` / `remove_text_run` for incremental edits. Refuses `wrong_element_type` unless the element is `type: 'text'`.

- `slideId` (`string`)
- `elementId` (`string`)
- `text` (`string`) _(optional)_
- `runs` (`array`) _(optional)_

### `append_text_run`

Insert a single styled run into a text element's `runs` array. If the element has no `runs` yet, creates the array. `position` defaults to the end.

- `slideId` (`string`)
- `elementId` (`string`)
- `run` (`object`) — Styled text run — Zod-validated server-side against `textRunSchema` (`{ text, color?, weight?, italic?, underline? }`).
- `position` (`integer`) _(optional)_

### `remove_text_run`

Remove a single run from a text element's `runs` array by zero-based index. Refuses `run_not_found` if the index is out of range (or `runs` is absent / empty).

- `slideId` (`string`)
- `elementId` (`string`)
- `index` (`integer`)

### `update_text_run_style`

Partial-merge into a single run's fields (color / weight / italic / underline / text). Each non-undefined field becomes one `add` or `replace` op depending on whether the run already has that field. Refuses `run_not_found` if the index is out of range.

- `slideId` (`string`)
- `elementId` (`string`)
- `index` (`integer`)
- `style` (`object`)

### `update_text_style`

Partial-merge into a text element's block-level style (fontFamily / fontSize / color / align / lineHeight). Emits one `add` or `replace` per provided field.

- `slideId` (`string`)
- `elementId` (`string`)
- `fontFamily` (`string`) _(optional)_
- `fontSize` (`number`) _(optional)_
- `color` (`string`) _(optional)_ — Hex `#RGB` / `#RRGGBB` / `#RRGGBBAA` or theme ref `theme:<dotted.path>`.
- `align` (`string`) _(optional)_ — enum: `left` / `center` / `right` / `justify`
- `lineHeight` (`number`) _(optional)_

### `update_shape`

Partial-merge into a shape element (shape kind / path / fill / stroke / cornerRadius). `stroke` is replaced wholesale; pass the full stroke object to change a sub-field. `custom-path` shapes need `path` — enforced at RIR compile time, not here.

- `slideId` (`string`)
- `elementId` (`string`)
- `shape` (`string`) _(optional)_ — enum: `rect` / `ellipse` / `line` / `polygon` / `star` / `custom-path`
- `path` (`string`) _(optional)_
- `fill` (`string`) _(optional)_ — Hex `#RGB` / `#RRGGBB` / `#RRGGBBAA` or theme ref `theme:<dotted.path>`.
- `stroke` (`object`) _(optional)_ — Stroke — Zod-validated server-side against `strokeSchema` (`{ color, width, dasharray?, linecap?, linejoin? }`).
- `cornerRadius` (`number`) _(optional)_

### `update_image`

Partial-merge into an image element (src / alt / fit). Empty-string `alt` removes the field; any other provided field becomes an `add` or `replace`.

- `slideId` (`string`)
- `elementId` (`string`)
- `src` (`string`) _(optional)_ — Asset reference `asset:<id>` — Zod-validated server-side.
- `alt` (`string`) _(optional)_
- `fit` (`string`) _(optional)_ — enum: `cover` / `contain` / `fill` / `none` / `scale-down`

### `update_video`

Partial-merge into a video element (src / trim / muted / loop / playbackRate). `trim` is validated against `trimWindowSchema` (endMs > startMs).

- `slideId` (`string`)
- `elementId` (`string`)
- `src` (`string`) _(optional)_ — Asset reference `asset:<id>`.
- `trim` (`object`) _(optional)_ — `{ startMs, endMs }` with `endMs > startMs`.
- `muted` (`boolean`) _(optional)_
- `loop` (`boolean`) _(optional)_
- `playbackRate` (`number`) _(optional)_

### `update_audio`

Partial-merge into an audio element (src / trim / mix / loop). `mix` is merged field-by-field (gain / pan / fadeInMs / fadeOutMs) onto any existing mix object; missing fields survive.

- `slideId` (`string`)
- `elementId` (`string`)
- `src` (`string`) _(optional)_ — Asset reference `asset:<id>`.
- `trim` (`object`) _(optional)_ — `{ startMs, endMs }` with `endMs > startMs`.
- `mix` (`object`) _(optional)_ — Audio mix patch — `{ gain?, pan?, fadeInMs?, fadeOutMs? }`. Merged field-by-field onto any existing mix.
- `loop` (`boolean`) _(optional)_

### `update_code`

Partial-merge into a code element (code / language / theme / showLineNumbers / wrap). Empty-string `theme` removes the field.

- `slideId` (`string`)
- `elementId` (`string`)
- `code` (`string`) _(optional)_
- `language` (`string`) _(optional)_ — Enum from `codeLanguageSchema` — Zod-validated server-side.
- `theme` (`string`) _(optional)_
- `showLineNumbers` (`boolean`) _(optional)_
- `wrap` (`boolean`) _(optional)_

### `update_embed`

Partial-merge into an embed element (src / sandbox / allowFullscreen). `sandbox` is replaced wholesale; pass the full array to toggle flags.

- `slideId` (`string`)
- `elementId` (`string`)
- `src` (`string`) _(optional)_
- `sandbox` (`array`) _(optional)_
- `allowFullscreen` (`boolean`) _(optional)_

### `set_element_flags`

Set element-level metadata (visible / locked / name) on any element regardless of type. Empty-string `name` removes the field.

- `slideId` (`string`)
- `elementId` (`string`)
- `visible` (`boolean`) _(optional)_
- `locked` (`boolean`) _(optional)_
- `name` (`string`) _(optional)_


## Invariants

- Every handler declares `bundle: 'element-cm1'`.
- Tool count 12 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-161
