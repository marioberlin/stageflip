---
'@stageflip/engine': minor
---

T-160 — Sixth handler bundle shipped: `clip-animation` (14 tools). Largest
write-tier bundle so far; covers clip-element props and per-element
animation editing across all 7 animation kinds + keyframed authoring.

Tools:

- `add_clip_element` — clip-specific shortcut over `add_element`
  (defaults for visible / locked / animations / transform).
- `update_clip_element` — replace `runtime` / `clipName` / `params` /
  `fonts` wholesale; `not_a_clip` for non-clip targets.
- `set_clip_params` — partial-merge on `params` (merge + remove),
  pointer-safe key encoding.
- `add_animation` / `remove_animation` / `clear_animations` —
  animation lifecycle on any element.
- `replace_animation` — wholesale replace (kind-change path);
  `mismatched_ids` if caller flips the animation id.
- `reorder_animations` — drift-gate reorder; `mismatched_count` /
  `mismatched_ids` standard reasons.
- `set_animation_timing` — swap the B1–B5 primitive.
- `set_animation_easing` — fade / slide / scale / rotate / color only;
  `wrong_animation_kind` for keyframed / runtime.
- `set_animation_autoplay` — toggle autoplay for runtime resume flow.
- `set_animation_kind_params` — partial-merge on the inner kind object;
  `kind` forbidden (`rejected_fields`).
- `add_keyframe` / `remove_keyframe` — keyframed-only edits;
  `min_keyframes` enforces the schema's ≥2 invariant.

39 new engine tests (33 handlers + 6 register); 174 total engine tests.
All 9 gates green.

Skill `tools/clip-animation/SKILL.md` flipped from placeholder to the
shipped per-tool contract.
