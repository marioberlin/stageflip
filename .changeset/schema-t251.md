---
'@stageflip/schema': minor
---

T-251 — Add deck-level `Document.masters: SlideMaster[]` + `Document.layouts: SlideLayout[]`, per-slide `Slide.layoutId`, and per-element `ElementBase.inheritsFrom: { templateId, placeholderIdx }`. New pure helper `applyInheritance(doc): Document` materializes per-element placeholder references at compile/read time. All additions are optional with `[]` / `undefined` defaults — existing persisted documents parse unchanged.
