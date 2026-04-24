---
title: Tools — Clip/Animation Bundle
id: skills/stageflip/tools/clip-animation
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-160
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/tools/create-mutate/SKILL.md
---

# Tools — Clip/Animation Bundle

Fourteen write-tier tools for clip-element props (runtime / clipName /
params / fonts) and element-level animations (add / remove / re-order,
timing, easing, autoplay, inner kind-params, keyframed operations).
Slide-mode only. Handlers type against `MutationContext`; mutations flow
through `ctx.patchSink.push(op)` as JSON-Patch. The Executor drains +
applies + re-reads between tool calls so chained animation edits in one
plan step see the previous mutation's effect.

Registration: `registerClipAnimationBundle(registry, router)` from
`@stageflip/engine`.

Every response is a discriminated union on `ok`. Failure branches carry
`reason` drawn from: `wrong_mode` / `slide_not_found` / `element_not_found`
/ `not_a_clip` / `animation_not_found` / `wrong_animation_kind` /
`keyframe_not_found` / `min_keyframes` / `mismatched_ids` /
`mismatched_count` / `rejected_fields`. Handlers never throw for
caller-controllable errors.

## Tools

### Clip-element props

#### `add_clip_element` — `{ slideId, runtime, clipName, params?, transform?, name?, fonts?, position? }`

Insert a new clip element on a slide. Fills in defaults for `visible`,
`locked`, `animations: []`, and a full-bleed `transform`. Element id
auto-generated as `clip-<n>`.

#### `update_clip_element` — `{ slideId, elementId, runtime?, clipName?, params?, fonts? }`

Replace top-level fields on an existing clip element. `params` and `fonts`
are replaced wholesale; use `set_clip_params` for a partial merge.
Refuses `not_a_clip` if `element.type !== 'clip'`.

#### `set_clip_params` — `{ slideId, elementId, merge?, remove? }`

Partial-merge edit on a clip element's `params`. `merge` sets/replaces
individual keys (`add` vs `replace` op chosen from current state);
`remove` deletes keys if present. Pointer-safe key encoding (RFC 6901).

### Animation lifecycle

#### `add_animation` — `{ slideId, elementId, animation, timing, autoplay?, id?, position? }`

Attach an animation. `animation` is the inner kind object (fade / slide /
scale / rotate / color / keyframed / runtime); `timing` is a B1–B5
primitive. Animation id auto-generated as `anim-<n>`; caller-supplied
colliding ids are reassigned.

#### `remove_animation` — `{ slideId, elementId, animationId }`

Remove a single animation by id. Reports remaining count.

#### `clear_animations` — `{ slideId, elementId }`

Replace the element's `animations` with `[]` in one patch. Reports the
prior count.

#### `replace_animation` — `{ slideId, elementId, animationId, animation }`

Wholesale-replace an existing animation. Use to change `kind`
(fade → keyframed). `animation.id` must equal `animationId` — otherwise
`mismatched_ids`.

#### `reorder_animations` — `{ slideId, elementId, order }`

Replace the element's animation order. `order` must list every existing
animation id exactly once. RIR compiler resolves in array order at
timing-flatten.

### Animation field edits

#### `set_animation_timing` — `{ slideId, elementId, animationId, timing }`

Swap the timing primitive on an animation. Any of the five B1–B5 kinds
accepted.

#### `set_animation_easing` — `{ slideId, elementId, animationId, easing }`

Replace `.animation.easing` on fade / slide / scale / rotate / color
animations. Refuses `wrong_animation_kind` for `keyframed` (easing lives
per-keyframe) and `runtime` (opaque).

#### `set_animation_autoplay` — `{ slideId, elementId, animationId, autoplay }`

Toggle `autoplay`. `false` stages the animation but parks visual progress
until a runtime `resume` event fires.

#### `set_animation_kind_params` — `{ slideId, elementId, animationId, updates }`

Partial-merge into the inner `animation` object — the kind-specific
params (`from`, `to`, `direction`, `distance`, `fromDegrees`, …). `kind`
is forbidden (`rejected_fields`); use `replace_animation` for
kind-change.

### Keyframes (for `keyframed` animations)

#### `add_keyframe` — `{ slideId, elementId, animationId, keyframe, position? }`

Insert a keyframe. `position` defaults to the end. Refuses
`wrong_animation_kind` if the animation isn't `keyframed`.

#### `remove_keyframe` — `{ slideId, elementId, animationId, index }`

Remove a keyframe by zero-based index. Refuses `min_keyframes` when only
2 keyframes remain (schema invariant: keyframed animations keep ≥2).

## Invariants

- Every handler declares `bundle: 'clip-animation'` (tool-bundles §Enforcement).
- All 14 handlers type against `MutationContext`; Executor's
  `ExecutorContext` satisfies it.
- Tool count 14 → well within the 30-tool I-9 budget.
- Handlers mutate via patches only. They never mutate `ctx.document`
  directly; they never call the LLM; they never reach runtime registries
  — `runtime` and `clipName` are opaque strings on the document.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Router: `concepts/tool-router/SKILL.md`
- Executor (consumer): `concepts/agent-executor/SKILL.md`
- Create/Mutate (sibling): `tools/create-mutate/SKILL.md`
- Task: T-160
