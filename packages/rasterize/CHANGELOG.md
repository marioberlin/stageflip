# @stageflip/rasterize

## 0.1.0

### Minor Changes

- 79397c0: T-245 — initial release. `@stageflip/rasterize` ships `rasterizeFromThumbnail`,
  a pure-TS PNG-crop primitive consumed by T-244 (Google Slides import
  image-fallback) and T-252 (Google Slides export image-fallback). Crops a
  pixel-space bbox out of a rendered slide PNG with deterministic output and a
  content-hashed asset id, leaving loss-flag emission and `AssetStorage` upload
  to consumers.
