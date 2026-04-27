---
"@stageflip/schema": patch
---

T-249: narrow `componentDefinitionSchema.body` from `z.unknown()` to a
typed `{ slots: SlotDefinition[]; layout: LayoutDescriptor }` shape, with
`slotDefinitionSchema` and `layoutDescriptorSchema` exported from a new
`./components.js` entry. The narrowing is additive — existing documents
with empty `components: {}` continue to parse. T-249's design-system
pipeline is the first emitter of populated components.
