---
'@stageflip/app-slide': minor
---

T-125b — `<ClipElementProperties>` slots into the T-125a
PropertiesPanel router for `element.type === 'clip'`. Resolves the
selected clip via `@stageflip/runtimes-contract`'s `findClip(kind)`,
reads its `propsSchema`, and mounts a `<ZodForm>` whose commits write
back to `element.params` through `useDocument().updateDocument`. Three
fallbacks: unknown clip kind → "not in any registered runtime"; clip
without a `propsSchema` → "no schema"; locked element → all inputs
disabled. The prior `prop-type-placeholder` notice remains for every
non-clip element type (chart / table / animation arrive in T-125c).
