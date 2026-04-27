---
"@stageflip/import-google-slides": minor
---

T-246: AI-QC convergence pass — `runAiQcConvergence(tree, opts)` converts
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
