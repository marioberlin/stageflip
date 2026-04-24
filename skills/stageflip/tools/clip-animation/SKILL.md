---
title: Tools — Clip Animation Bundle
id: skills/stageflip/tools/clip-animation
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-160
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Clip Animation Bundle

Pick and configure clips + animations across all registered runtimes.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/clip-animation/`.

Registration: see `@stageflip/engine`'s `registerClipAnimationBundle` (or equivalent) export.

## Tools

### `add_clip_element`

Insert a new clip element on a slide. Clip-specific shortcut over `add_element`: caller supplies only `runtime` / `clipName` / `params`, the handler fills in defaults for `visible` / `locked` / `animations` / `transform`. Element id is auto-generated as `clip-<n>`.

- `slideId` (`string`)
- `runtime` (`string`)
- `clipName` (`string`)
- `params` (`object`) _(optional)_
- `transform` (`object`) _(optional)_ — Element transform — `{ x, y, width, height, rotation, opacity }`. Zod-validated server-side.
- `name` (`string`) _(optional)_
- `fonts` (`array`) _(optional)_
- `position` (`integer`) _(optional)_

### `update_clip_element`

Replace top-level fields on an existing clip element (`runtime`, `clipName`, `params`, `fonts`). Fields left out remain unchanged. `params` and `fonts` are replaced wholesale; use `set_clip_params` for a partial-merge of `params`. Refuses with `not_a_clip` if the element's `type` isn't `clip`.

- `slideId` (`string`)
- `elementId` (`string`)
- `runtime` (`string`) _(optional)_
- `clipName` (`string`) _(optional)_
- `params` (`object`) _(optional)_
- `fonts` (`array`) _(optional)_

### `set_clip_params`

Partial-merge edit on a clip element's `params` object. `merge` sets/replaces values at individual keys; `remove` deletes keys. Use this instead of `update_clip_element` when you only want to tweak one or two params without rewriting the whole object. Refuses with `not_a_clip` if the element's `type` isn't `clip`.

- `slideId` (`string`)
- `elementId` (`string`)
- `merge` (`object`) _(optional)_
- `remove` (`array`) _(optional)_

### `add_animation`

Attach a new animation to any element. Caller provides the inner kind-specific `animation` object (fade / slide / scale / rotate / color / keyframed / runtime) plus a `timing` primitive. Animation id is auto-generated as `anim-<n>` when omitted; if a caller-supplied id collides, a fresh one is assigned. `position` inserts at an index; default is the end of the array.

- `slideId` (`string`)
- `elementId` (`string`)
- `animation` (`object`) — Inner animation kind — Zod-validated server-side against `animationKindSchema` (fade / slide / scale / rotate / color / keyframed / runtime, discriminated on `kind`).
- `timing` (`object`) — Timing primitive — Zod-validated server-side against `timingPrimitiveSchema` (one of the five B1–B5 kinds).
- `autoplay` (`boolean`) _(optional)_
- `id` (`string`) _(optional)_
- `position` (`integer`) _(optional)_

### `remove_animation`

Remove a single animation from an element by animation id.

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)

### `clear_animations`

Remove every animation from an element in a single `replace` op. `cleared` reports how many animations were present before the reset (0 is valid).

- `slideId` (`string`)
- `elementId` (`string`)

### `replace_animation`

Wholesale-replace an existing animation by id. The new animation's `id` must equal `animationId` (use delete + add to change the id). Use this to swap animation kinds (e.g. fade → keyframed).

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `animation` (`object`) — Full animation object — `{ id, timing, animation, autoplay? }`. Zod-validated server-side; `animation.id` must equal `animationId`.

### `reorder_animations`

Replace the element's animation order. `order` must contain every existing animation id exactly once. Emits a single `replace` op on the element's `animations` array. The RIR compiler resolves animations in array order at timing-flatten, so this reorder directly affects render ordering.

- `slideId` (`string`)
- `elementId` (`string`)
- `order` (`array`)

### `set_animation_timing`

Replace the timing primitive on an animation. Any of the five B1–B5 kinds (`absolute` / `relative` / `anchored` / `beat` / `event`) is accepted; the router validates the payload against `timingPrimitiveSchema`.

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `timing` (`object`) — Timing primitive — Zod-validated server-side against `timingPrimitiveSchema` (one of the five B1–B5 kinds).

### `set_animation_easing`

Replace the `easing` on a fade / slide / scale / rotate / color animation. Refuses with `wrong_animation_kind` for `keyframed` (easing lives per-keyframe) and `runtime` (opaque to engine). Easing payload can be a named keyword, cubic-bezier, spring, or steps.

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `easing` (`object`) — Easing — Zod-validated server-side against `easingSchema`. Accepts a named string, or a parametric object (`cubic-bezier` / `spring` / `steps`). Strings are also accepted at the top level.

### `set_animation_autoplay`

Set the animation's `autoplay` boolean. `false` stages the animation but leaves its visual parked until a runtime `resume` event fires.

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `autoplay` (`boolean`)

### `set_animation_kind_params`

Partial-merge into the inner `animation` object (the kind-specific params — `from`, `to`, `direction`, `distance`, `fromDegrees`, etc.). Cannot change `kind` — use `replace_animation` for that. Each update becomes one `replace` op on `.../animation/<field>`.

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `updates` (`object`) — Field → new value within the inner `animation` object. `kind` is forbidden.

### `add_keyframe`

Insert a keyframe into a `keyframed` animation's `keyframes` array. `position` defaults to the end. `at` in the keyframe is 0..1 over the animation duration (Zod-validated). Refuses with `wrong_animation_kind` if the animation isn't `keyframed`.

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `keyframe` (`object`) — Keyframe — `{ at: 0..1, value: any, easing?: Easing }`. Zod-validated server-side.
- `position` (`integer`) _(optional)_

### `remove_keyframe`

Remove a keyframe by zero-based `index`. Refuses with `wrong_animation_kind` if the animation isn't `keyframed`, `keyframe_not_found` if the index is out of range, and `min_keyframes` if the animation only has 2 keyframes (schema requires ≥2 — use `replace_animation` to change kind instead).

- `slideId` (`string`)
- `elementId` (`string`)
- `animationId` (`string`)
- `index` (`integer`)


## Invariants

- Every handler declares `bundle: 'clip-animation'`.
- Tool count 14 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-160
