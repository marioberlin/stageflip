---
"@stageflip/runtimes-contract": minor
---

Initial ClipRuntime contract + registry (T-060).

Types: `ClipRuntime`, `ClipDefinition<P>`, `ClipRenderContext<P>`,
`FontRequirement`, `RuntimeTier = 'live' | 'bake'`,
`RuntimePrepareContext`.

Registry: `registerRuntime`, `getRuntime`, `listRuntimes`,
`unregisterRuntime`, `findClip`, `__clearRuntimeRegistry`.

Validates on register: non-empty id, duplicate id, unknown tier, and
clip map keys that disagree with their definition's `kind`. `findClip`
resolves a globally unique clip kind to the owning runtime; first
registered wins on tie.

No concrete runtime code yet — T-061 adds the frame-runtime bridge;
T-062..T-066 follow.
