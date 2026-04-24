# @stageflip/import-slidemotion-legacy

## 0.1.0

### Minor Changes

- 67c53aa: T-130 — one-way converter from the legacy SlideMotion
  `CanonicalDocument` JSON shape to a canonical StageFlip `Document` in
  `mode='slide'`. MVP covers `text` / `image` / `shape` (rect, ellipse,
  line, polygon, custom-path) / recursive `group` elements, plus solid-
  colour + image slide backgrounds, numeric slide duration, and
  document `meta.{id, title, authorId, createdAt, updatedAt}`.

  Unmappable structures (charts, tables, video, embed, gradient
  backgrounds, timing, animations, captions, brand, etc.) drop with a
  structured `Warning` the caller surfaces. Ids are sanitised to the
  canonical URL-safe alphabet and de-duplicated within their scope.
  Output is final-gated through `documentSchema.parse()` so callers can
  rely on the contract "one-way legacy → valid canonical Document".

  Public API:

  - `importLegacyDocument(input: unknown) → ImportResult`
  - `ImportResult = { document: Document; warnings: Warning[] }`
  - `Warning = { path, reason, detail? }`

  New dep: `zod@3.25.76` (already workspace-pinned via `@stageflip/schema`).
  34 new unit tests (happy path, lossy fallbacks, nested groups, input
  validation, id-collision handling) + sanitizer coverage.

### Patch Changes

- Updated dependencies [36d0c5d]
  - @stageflip/schema@0.1.0
