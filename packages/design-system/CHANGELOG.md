# @stageflip/design-system

## 0.1.0

### Minor Changes

- a4bb803: T-249: 8-step theme learning pipeline.

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
