---
"@stageflip/schema": minor
---

T-265: add `BlenderClip` element to the canonical schema.

`BlenderClip` is the bake-tier element type. It carries:

- `scene: { template, params }` — references a built-in Blender scene
  template + a parameter bag.
- `duration: { durationMs, fps }` — render extent.
- `inputsHash` — pinned SHA-256 cache key into
  `bakes/{inputsHash}/frame-{N}.png`.

Existing fixtures parse unchanged; the discriminated union now has 12
branches. Hash verification + bake submission live in
`@stageflip/runtimes-blender`.
