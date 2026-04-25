---
"@stageflip/import-pptx": patch
---

T-241a: nested group transform accumulator.

`parsePptx` now runs `accumulateGroupTransforms` as a post-walk pass before
returning. Group transforms — including `<a:chOff>` / `<a:chExt>` child-coord
scaling and rotation around the group's center — are folded into descendant
transforms so leaf children carry world-space coordinates.

`ParsedGroupElement` gains parser-side fields `groupOrigin` and `groupExtent`
capturing the OOXML child-coordinate space. `CanonicalSlideTree` gains a
`transformsAccumulated?: boolean` marker — the accumulator is idempotent
(re-running on accumulated input is a no-op).

Public surface adds `accumulateGroupTransforms`. Removes the
`LF-PPTX-NESTED-GROUP-TRANSFORM` variant from `LossFlagCode` since the
placeholder flag is no longer emitted.

Note for downstream callers: this is an enum-shape break (a `LossFlagCode`
literal disappears), but `@stageflip/import-pptx` is `private: true` and has
no external consumers; bump kept at `patch` per workspace convention.
