---
title: Clip Element Catalogue
id: skills/stageflip/concepts/clip-elements
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-265
related:
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
---

# Clip Element Catalogue

`Element` is the discriminated union of every shape a slide / video / display
can carry. Two element types specifically carry **motion**:

- `clip` — the generic motion element. Names a registered runtime + a clip
  kind from that runtime's registry. Frame-deterministic and interactive
  runtimes both register clips this way.
- `blender-clip` — the bake-tier element (T-265). Names a built-in scene
  template (`fluid-sim`, `product-render`, `particle-burst`) plus a
  parameter bag, plus a pinned `inputsHash` that addresses the cache.

Every other element type (`text`, `image`, `video`, `audio`, `shape`,
`group`, `chart`, `table`, `embed`, `code`) is structural / static.

## `BlenderClip`

```ts
{
  type: 'blender-clip',
  scene: { template: string, params: Record<string, unknown> },
  duration: { durationMs: number, fps: number },
  inputsHash: string  // sha256 over canonical(scene + duration)
  // ...elementBase fields (id, transform, visible, locked, animations)
}
```

`inputsHash` is the cache key into `bakes/{inputsHash}/frame-{N}.png` per
`docs/architecture.md:330`. The hash is verifiable: given the descriptor,
`computeInputsHash({ scene, duration })` returns the same hash. The submit
handler rejects mismatched hashes with `code: 'inputs-hash-mismatch'`.

See `skills/stageflip/concepts/runtimes/SKILL.md` §"Bake tier (T-265)" for
the full lifecycle.

### Authoring rule

When you add a `BlenderClip` to a document, compute `inputsHash` once and
pin it in the schema. Re-renders with the same hash skip the bake; any
input change produces a new hash and a fresh render.

### Built-in templates (T-265)

| `template` | Purpose | Required params |
|---|---|---|
| `fluid-sim` | Liquid simulations | `viscosity`, `domainSize`, `color` |
| `product-render` | 360° product showcase | `objectAsset` (required), `rotationDegPerSec`, `background` |
| `particle-burst` | Confetti / spark effects | `count`, `color`, `burstStrength` |

Per-template JSON Schemas live in
`services/blender-worker/templates/<name>/params.schema.json`. The set is
closed in v1; adding a template is a follow-up task.

## Cross-links

- `packages/schema/src/elements/blender-clip.ts` — Zod schema.
- `packages/schema/src/elements/index.ts` — discriminated union.
- `services/blender-worker/templates/` — built-in scene templates.
