# @stageflip/export-pptx

## 0.1.0

### Minor Changes

- f1f4801: T-253-base — foundational PPTX writer. Converts the `@stageflip/export-pptx` stub into a working writer that emits `[Content_Types].xml`, root rels, `ppt/presentation.xml`, slide parts, theme stub, docProps, and media for image assets. Round-trips text / image / preset-shape / group elements through `parsePptx → exportPptx → parsePptx` under a documented equality predicate. Layouts, masters, tables, videos, embedded fonts, animations, notes, and theme write-back are deferred to follow-on riders (T-253-rider for layouts/masters; future riders for the rest).
- d393eff: T-253-rider — placeholder-inheritance write-back. Extends `@stageflip/export-pptx` so it emits `<p:sldLayout>` / `<p:sldMaster>` parts mirroring `Document.layouts` / `Document.masters`, plus per-element `<p:nvSpPr><p:nvPr><p:ph type="..." idx="..."/></p:nvPr></p:nvSpPr>` references when `inheritsFrom` resolves. Override suppression uses `compareToPlaceholder` from `@stageflip/schema` (the inverse of `applyInheritance`); slide-side fields whose value matches the placeholder are omitted from the slide XML so the runtime inherits. Three new loss flags — `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND`, `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND`, `LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH` — surface unresolvable references; both unresolved cases fall back to materialized geometry. The base writer's layouts-empty path is unchanged (no regression).

### Patch Changes

- Updated dependencies [3280984]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/loss-flags@0.1.0
  - @stageflip/schema@0.1.0
