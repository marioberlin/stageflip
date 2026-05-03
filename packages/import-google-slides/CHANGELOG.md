# @stageflip/import-google-slides

## 0.2.0

### Minor Changes

- 9d8064c: T-244 — convert `@stageflip/import-google-slides` from `export {}` stub into the
  foundational Google Slides importer. Ships the `parseGoogleSlides(opts)` entry
  point plus the OAuth + Slides-API-v1 client, the `CvCandidateProvider` interface
  (stub + HTTP impls), the deterministic API-element ↔ CV-candidate matcher (text
  content + center containment + z-order plausibility), placeholder /
  layout / master extraction with per-element `inheritsFrom`, and the six
  `LF-GSLIDES-*` loss-flag codes. Output is a `CanonicalSlideTree` matching
  the shape `@stageflip/import-pptx` already emits, with `pendingResolution`
  records carried for T-246's Gemini fallback loop. First non-stub release:
  0.0.0 → 0.1.0.
- 58d78e7: T-246: AI-QC convergence pass — `runAiQcConvergence(tree, opts)` converts
  `tree.pendingResolution` residuals into resolved canonical values via Gemini
  multimodal calls. Single-pass per residual; default `acceptThreshold: 0.85`,
  `maxCallsPerDeck: 100`. Schema-aligned shape mapping (`'rounded-rect'` →
  `rect` + `cornerRadius`). Element-replacement (not in-place) for
  `ShapeElement → TextElement` conversion, preserving `id`, `transform`,
  `name`, `visible`, `locked`, `inheritsFrom`, `animations`.

  Contract amendment to T-244: `parseGoogleSlides` now retains
  `tree.pageImagesPng: Record<slideId, { bytes, width, height }>` so the AI-QC
  pass can crop per-element slices for Gemini.

  New loss flag: `LF-GSLIDES-AI-QC-CAP-HIT` (warn / other; deck-level summary
  when the cost cap is exceeded). Reuses `LF-GSLIDES-LOW-MATCH-CONFIDENCE`
  per unresolved residual.

### Patch Changes

- Updated dependencies [eeee940]
- Updated dependencies [acbc394]
- Updated dependencies [ea7e66a]
- Updated dependencies [e2f5e55]
- Updated dependencies [cefce71]
- Updated dependencies [fc78eac]
- Updated dependencies [5a02994]
- Updated dependencies [ca51076]
- Updated dependencies [226d85b]
- Updated dependencies [29701d5]
- Updated dependencies [84c917a]
- Updated dependencies [d4d690d]
- Updated dependencies [46a4a3a]
- Updated dependencies [58d78e7]
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
- Updated dependencies [b8808c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/import-pptx@0.1.0
  - @stageflip/llm-abstraction@0.1.0
  - @stageflip/loss-flags@0.1.0
  - @stageflip/schema@0.1.0
