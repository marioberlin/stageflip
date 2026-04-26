---
'@stageflip/schema': patch
---

T-253-rider sibling — adds `compareToPlaceholder(slideEl, placeholderEl)` to `@stageflip/schema/src/inheritance.ts` as the inverse of `applyInheritance`. Returns the set of top-level `Element` keys whose slide-side value matches the placeholder default (and may therefore be suppressed by an exporter). Shares `applyInheritance`'s shallow-on-top-level semantics: `transform` is whole-or-nothing, `animations: []` is never suppressed, `id` / `type` / `inheritsFrom` always preserved. Additive — no breaking changes.
