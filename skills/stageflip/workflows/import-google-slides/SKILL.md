---
title: Workflow — Import Google Slides
id: skills/stageflip/workflows/import-google-slides
tier: workflow
status: substantive
last_updated: 2026-04-27
owner_task: T-244
related:
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/concepts/design-system-learning
  - skills/stageflip/reference/import-google-slides
---

# Workflow — Import Google Slides

`@stageflip/import-google-slides`'s `parseGoogleSlides` converts a Google
Slides presentation id + an OAuth token getter into a `CanonicalSlideTree`
matching the shape `@stageflip/import-pptx` emits. The output preserves
native grouping, tables with merged cells, and placeholder inheritance via
the `inheritsFrom` field landed in T-251.

Beyond a naive Slides-API client, the importer runs a **pixel-candidate
pipeline**: a deterministic CV pass on the per-slide rendered PNG produces
text-line / shape / region candidates. A matching pass pairs each Slides API
element with one or more candidates to recover information the API alone
does not expose. Candidates that fail to match deterministically surface as
`pendingResolution` records for T-246's Gemini multimodal fallback to
upgrade.

**The rendered PNG is the source of truth.** API geometry is reference;
pixels are ground truth.

## Pipeline

1. `presentations.get` → an `ApiPresentation` (slides, layouts, masters,
   page elements with `transform` + `size`).
2. For every slide: `presentations.pages.getThumbnail` returns a JSON
   `Thumbnail` with `{contentUrl, width, height}`. A second GET on
   `contentUrl` (without the OAuth header — it's a short-lived public link)
   returns the PNG bytes at the actual rendered dimensions.
3. The `CvCandidateProvider` (stubbed in tests, HTTP in production)
   processes the PNG and returns candidates keyed per detector
   (textLines / contours / masks).
4. For each API page element (recursing into `elementGroup.children`), the
   matcher computes:
   - **Text-content equality** — Unicode NFC + collapsed whitespace +
     case-sensitive comparison of `shape.text` against `textLine.text`.
   - **Center-inside containment** — element bbox center must fall inside
     a candidate's bbox (or polygon).
   - **Z-order plausibility** — 0.15 confidence cost per z-rank delta step.
5. `overallConfidence = min(content, position) * (1 - zPenalty)`. Above
   threshold (default **0.78**) → emit canonical element with the
   candidate's values. Below → emit canonical element with API-only values
   plus `LF-GSLIDES-LOW-MATCH-CONFIDENCE`, and push a residual into
   `tree.pendingResolution[slideId][elementId]` for T-246.

## Geometry math

Slides API exposes a true 2×3 affine
`{scaleX, scaleY, shearX, shearY, translateX, translateY, unit}` per element.
Page size is `presentation.pageSize` in EMU. The thumbnail's
`{width, height}` give the actual rendered render-pixel dimensions
(non-16:9 pages produce different heights even at the LARGE thumbnail size).

```
emuPerPx = renderSize / pageSizeEmu       (per-axis)
elementBboxPx = applyAffineToUnitSquare(worldTransform * size) * emuPerPx
worldTransform = composeAffines(parent, ..., child)
```

`composeAffines` is package-local to `@stageflip/import-google-slides`; the
math is the standard 3×3 augmented matrix product. **No cross-package
extraction** — `@stageflip/import-pptx`'s `accumulateGroupTransforms`
operates on a domain-specific `GroupFrame` (chOff/chExt + rotation-around-
center) and is intentionally untouched in T-244.

## Native grouping, tables, placeholders

- **Groups**: `pageElement.elementGroup.children` recurses into a
  `ParsedGroupElement` with nested `children: ParsedElement[]`. Group
  transforms compose into descendants via `composeAffines`. No flattening.
- **Tables**: `pageElement.table.tableRows[].tableCells[]` emits a
  `TableElement` with `colspan` / `rowspan` set from the API's `columnSpan`
  / `rowSpan`. Inconsistent spans (overlap, zero, overflow) trigger
  `LF-GSLIDES-TABLE-MERGE-LOST` and a fallback to per-slot independent cells.
- **Placeholders**: `shape.placeholder.{type, index, parentObjectId}`
  populates `ElementBase.inheritsFrom: { templateId, placeholderIdx }`.
  Layouts and masters parse first into `Document.layouts` / `Document.masters`;
  their placeholder elements are emitted ahead of slides. If
  `parentObjectId` doesn't resolve to a parsed layout/master, the parser
  emits `LF-GSLIDES-PLACEHOLDER-INLINED` and inlines the API geometry.
  The transitive walk (layout → master) is the RIR `applyInheritance`
  pass's job; T-244 only emits the slide-side `inheritsFrom`.

## Loss flags taxonomy

| Code | Severity | Category | Emitted when |
|---|---|---|---|
| `LF-GSLIDES-PADDING-INFERRED` | info | shape | API element geometry doesn't match CV text-line bbox; padding inferred from delta. |
| `LF-GSLIDES-FONT-SUBSTITUTED` | warn | font | API `textRun.style.fontFamily` not in local font cache. |
| `LF-GSLIDES-IMAGE-FALLBACK` | warn | media | Element can't be modeled cleanly; placeholder `ParsedAssetRef.unresolved` for T-245's `rasterizeFromThumbnail` to materialize. |
| `LF-GSLIDES-LOW-MATCH-CONFIDENCE` | warn | other | Match confidence below threshold; element ships with API-only values. T-246 may upgrade. |
| `LF-GSLIDES-PLACEHOLDER-INLINED` | warn | shape | `placeholder.parentObjectId` doesn't resolve; geometry inlined. |
| `LF-GSLIDES-TABLE-MERGE-LOST` | error | shape | Table spans inconsistent; per-slot fallback. |

The wrapper `emitLossFlag` (in `@stageflip/import-google-slides/loss-flags`)
auto-fills `source: 'gslides'` and resolves severity/category from
`CODE_DEFAULTS`.

## Asset bytes

Image `pageElement.image.contentUrl` flows through as
`ParsedAssetRef.unresolved` with `oocxmlPath` repurposed as the URL string.
Callers chain `resolveAssets` (re-exported from `@stageflip/import-pptx`)
with the included `gslidesUrlFetcher` to upload bytes:

```ts
const tree = await parseGoogleSlides({ presentationId, auth, cv });
const resolved = await resolveAssets(tree, gslidesUrlFetcher(), storage);
```

## OOS

- **T-245** owns the slide-rasterization primitive. Unresolvable elements
  surface as `LF-GSLIDES-IMAGE-FALLBACK` + a placeholder `ParsedAssetRef`;
  T-245 runs in a separate post-walk pass.
- **T-246** owns the Gemini multimodal fallback. T-244 surfaces residuals
  in `tree.pendingResolution`; T-246 reads them and writes back resolved
  values.
- **T-244-cv-worker** owns the production CV worker (PaddleOCR / OpenCV /
  SAM 2). T-244 ships only the TS interface, the test stub, and the HTTP
  client.
- **OAuth wiring** lives in `apps/api`. T-244 consumes a
  `GoogleAuthProvider` interface.
- **Custom font fetch** (`fonts.googleapis.com`) is deferred to T-249.
  T-244 emits `LF-GSLIDES-FONT-SUBSTITUTED` when an API-named font isn't in
  the local cache.
