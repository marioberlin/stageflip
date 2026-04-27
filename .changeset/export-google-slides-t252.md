---
'@stageflip/export-google-slides': minor
---

T-252: First release of `@stageflip/export-google-slides` — render-diff
convergence loop writer that converts a canonical `Document` into a Google
Slides presentation via `presentations.batchUpdate`. Three tier modes
(`fully-editable` / `hybrid` (default) / `pixel-perfect-visual`),
preference-ordered plan emission (placeholder-update > duplicate-similar >
create-from-scratch), up to 3 convergence iterations with image-fallback
via `@stageflip/rasterize` for residuals, eight new `LF-GSLIDES-EXPORT-*`
loss-flag codes. Hand-rolled Slides + Drive API client (no `googleapis`
dep) per T-244's accepted precedent. Round-trip via T-244's
`parseGoogleSlides`.
