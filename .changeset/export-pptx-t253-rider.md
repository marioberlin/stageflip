---
'@stageflip/export-pptx': minor
---

T-253-rider — placeholder-inheritance write-back. Extends `@stageflip/export-pptx` so it emits `<p:sldLayout>` / `<p:sldMaster>` parts mirroring `Document.layouts` / `Document.masters`, plus per-element `<p:nvSpPr><p:nvPr><p:ph type="..." idx="..."/></p:nvPr></p:nvSpPr>` references when `inheritsFrom` resolves. Override suppression uses `compareToPlaceholder` from `@stageflip/schema` (the inverse of `applyInheritance`); slide-side fields whose value matches the placeholder are omitted from the slide XML so the runtime inherits. Three new loss flags — `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND`, `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND`, `LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH` — surface unresolvable references; both unresolved cases fall back to materialized geometry. The base writer's layouts-empty path is unchanged (no regression).
