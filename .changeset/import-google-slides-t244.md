---
'@stageflip/import-google-slides': minor
---

T-244 — convert `@stageflip/import-google-slides` from `export {}` stub into the
foundational Google Slides importer. Ships the `parseGoogleSlides(opts)` entry
point plus the OAuth + Slides-API-v1 client, the `CvCandidateProvider` interface
(stub + HTTP impls), the deterministic API-element ↔ CV-candidate matcher (text
content + center containment + z-order plausibility), placeholder /
layout / master extraction with per-element `inheritsFrom`, and the six
`LF-GSLIDES-*` loss-flag codes. Output is a `CanonicalSlideTree` matching
the shape `@stageflip/import-pptx` already emits, with `pendingResolution`
records carried for T-246's Gemini fallback loop. First non-stub release:
0.0.0 → 0.1.0.
