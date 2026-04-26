---
'@stageflip/export-pptx': minor
---

T-253-base — foundational PPTX writer. Converts the `@stageflip/export-pptx` stub into a working writer that emits `[Content_Types].xml`, root rels, `ppt/presentation.xml`, slide parts, theme stub, docProps, and media for image assets. Round-trips text / image / preset-shape / group elements through `parsePptx → exportPptx → parsePptx` under a documented equality predicate. Layouts, masters, tables, videos, embedded fonts, animations, notes, and theme write-back are deferred to follow-on riders (T-253-rider for layouts/masters; future riders for the rest).
