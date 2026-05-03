# @stageflip/export-google-slides

## 0.2.0

### Minor Changes

- 5ba9be7: T-252: First release of `@stageflip/export-google-slides` — render-diff
  convergence loop writer that converts a canonical `Document` into a Google
  Slides presentation via `presentations.batchUpdate`. Three tier modes
  (`fully-editable` / `hybrid` (default) / `pixel-perfect-visual`),
  preference-ordered plan emission (placeholder-update > duplicate-similar >
  create-from-scratch), up to 3 convergence iterations with image-fallback
  via `@stageflip/rasterize` for residuals, eight new `LF-GSLIDES-EXPORT-*`
  loss-flag codes. Hand-rolled Slides + Drive API client (no `googleapis`
  dep) per T-244's accepted precedent. Round-trip via T-244's
  `parseGoogleSlides`.

### Patch Changes

- Updated dependencies [9d8064c]
- Updated dependencies [58d78e7]
- Updated dependencies [3280984]
- Updated dependencies [79397c0]
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
  - @stageflip/import-google-slides@0.2.0
  - @stageflip/loss-flags@0.1.0
  - @stageflip/rasterize@0.1.0
  - @stageflip/schema@0.1.0
