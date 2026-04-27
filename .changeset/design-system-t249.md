---
"@stageflip/design-system": minor
---

T-249: 8-step theme learning pipeline.

`learnTheme(opts)` walks a parsed `Document` through 8 deterministic steps:
color extraction + Lab-space k-means clustering, typography clustering,
spacing extraction, shape-language reporting, structural-hash component
detection, Google Fonts asset fetching, deterministic token naming, and
in-place writeback that replaces hex literals with `theme:foo.bar` refs.

The function MUTATES `opts.doc` — callers needing to preserve the original
must `structuredClone(doc)` first. Output is byte-deterministic given the
same inputs + `kMeansSeed` + `modifiedAt`.

Three new loss-flag codes (all `source: 'design-system'`):
- `LF-DESIGN-SYSTEM-FONT-FETCH-FAILED`
- `LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER`
- `LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED`
