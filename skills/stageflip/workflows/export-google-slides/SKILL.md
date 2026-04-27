---
title: Workflow — Export Google Slides
id: skills/stageflip/workflows/export-google-slides
tier: workflow
status: substantive
last_updated: 2026-04-27
owner_task: T-252
related:
  - skills/stageflip/workflows/import-google-slides
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/reference/export-google-slides
  - skills/stageflip/reference/rasterize
---

# Workflow — Export Google Slides

`@stageflip/export-google-slides`'s `exportGoogleSlides` converts a canonical
`Document` into a Google Slides presentation via the Slides API's
`presentations.batchUpdate`. T-252 is the closing piece of the Slides triad
(import T-244 + AI-QC T-246 + export T-252) and the peer of `@stageflip/export-pptx`.

The challenge that distinguishes it from `export-pptx`: **Google Slides
server-side rendering silently drifts from any one-shot batchUpdate write**.
Round-trip fidelity requires a render-diff convergence loop after the initial
apply.

## Pipeline

1. **Resolve presentation target.** `opts.presentationId` undefined → call
   `presentations.create`; defined → overwrite via `presentations.batchUpdate`.
2. **Read existing presentation state** via `presentations.get` (overwrite
   path only). The response normalizes into `buildPlan.existingPages` so
   option (b) (duplicate-similar) can match against live target-slide
   candidates. A read failure is non-fatal — surfaced as
   `LF-GSLIDES-EXPORT-API-ERROR` and the planner falls through to options
   (a) → (c).
3. **Build plan** (`plan/build-plan.ts`). Walks every slide's elements and
   emits a preference-ordered list of mutation requests:
   - **(a) `InsertText` against the inherited placeholder** when the
     canonical element carries `inheritsFrom` resolving to a layout/master
     placeholder. The shape's properties are NOT updated — that would
     reset theme bindings; we rely on inheritance. (Non-text inheritsFrom
     placeholders emit zero requests.)
   - **(b) `DuplicateObjectRequest` + modifications** when a "similar"
     object already exists on the target slide (same kind, bbox center
     within 50 px, text 80% Levenshtein-similar).
   - **(c) `CreateShapeRequest` / `CreateImageRequest` / `CreateTableRequest`
     from scratch** when neither (a) nor (b) applies.
   - **Group export ordering**: child creates emit FIRST, then a single
     `GroupObjectsRequest` binds them.
4. **Initial apply** of the plan via one `presentations.batchUpdate` call.
5. **Convergence loop** (`convergence/run-loop.ts`) — runs unless tier is
   `fully-editable`. Up to `maxIterations` (default 3) of:
   - Fetch the rendered slide PNG via `presentations.pages.getThumbnail`.
   - Render the canonical-side golden via `RendererCdpProvider.renderSlide`
     **at the API thumbnail's actual dimensions** (`LARGE` is 1600 px wide
     with auto-height — 16:9 → 900, 4:3 → 1200, 3:1 → 533, etc.).
   - Run the **pixel-diff pipeline** (`diff/`):
     - `computePixelDiff(apiPng, goldenPng)` — per-pixel RGBA-channel-delta
       threshold (default 8/255) yields a binary mask + perceptualDiff scalar.
     - `findRegions(mask)` — 4-connectivity flood-fill labeling produces
       bounding boxes + pixel counts for every connected diff component.
     - `deriveObservations(elements, regions)` — for each canonical element,
       observed bbox = union of (element bbox) and every diff region whose
       center falls within the element's expanded bbox (default 32 px
       expansion). No-overlap → observed = canonical (zero delta).
   - `computeDiff(...)` → per-element + whole-slide diff against tolerances.
   - If `allElementsInTolerance` → exit.
   - Otherwise `planAdjustments(...)` → inverse-delta
     `UpdatePageElementTransformRequest`s. If empty → loop is **stalled**.
   - Apply the adjustments and iterate.

   **Test seam**: `RunLoopInput.observationsByIteration[i]`, when defined,
   supersedes the pixel-diff pipeline for iteration `i`. Production callers
   pass `[]` (or undefined) and the loop runs the real pipeline.
6. **Image-fallback** (`fallback/image-fallback.ts`) for residuals at loop
   exit:
   - Crop the canonical golden via T-245's `rasterizeFromThumbnail` with
     `paddingPx: 0`.
   - Upload bytes via `drive.files.create` (multipart `image/png`).
   - Emit `DeleteObjectRequest` on the residual + `CreateImageRequest`
     pointing at the uploaded `contentUrl`.
   - Emit `LF-GSLIDES-EXPORT-FALLBACK` (warn, media).
   - **Group residuals**: a single `DeleteObjectRequest` against the group
     deletes the group AND its children (Slides cascades). Never emit
     per-child deletes — they target objects that no longer exist.

## Tier modes

| Mode | Convergence loop | Image-fallback | Editability |
|---|---|---|---|
| `fully-editable` | NO | NO | maximum |
| `hybrid` (default) | YES | YES (residuals only) | high |
| `pixel-perfect-visual` | maxIterations clamped to 1 | YES, **every element** | minimum |

Default `hybrid` matches the `~90% deterministic + ~10% fallback` pattern
the importer side uses (T-244 + T-246).

## Convergence tolerances

| Field | Default | Applies to |
|---|---|---|
| `textBboxPositionPx` | 2 | text bbox x/y drift |
| `textBboxSizePx` | 3 | text bbox width/height drift |
| `imageShapePx` | 1 | image / shape / table position+size drift |
| `perceptualDiffThreshold` | 0.02 | whole-slide gate (in-tolerance even if individual elements drift) |

## Loss flags

Eight new codes, all `source: 'gslides'`:

| Code | Severity | Category | Emitted when |
|---|---|---|---|
| `LF-GSLIDES-EXPORT-FALLBACK` | warn | media | element image-rasterized after convergence |
| `LF-GSLIDES-EXPORT-API-ERROR` | error | other | a `batchUpdate` request returned 4xx/5xx |
| `LF-GSLIDES-EXPORT-CONVERGENCE-STALLED` | warn | other | adjustments planned to zero before tolerance |
| `LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED` | info | animation | one per slide that had any animations |
| `LF-GSLIDES-EXPORT-NOTES-DROPPED` | info | other | one per slide with non-empty notes |
| `LF-GSLIDES-EXPORT-FONT-SUBSTITUTED` | warn | font | canonical font outside Slides supported list |
| `LF-GSLIDES-EXPORT-TABLE-ROTATION-LOST` | warn | shape | table cell with non-zero rotation (reserved) |
| `LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED` | warn | shape | `custom-path` shape degraded to image-fallback |

`LF-GSLIDES-EXPORT-CONVERGENCE-STALLED` and `LF-GSLIDES-EXPORT-FALLBACK`
co-emit when the loop stalls AND the residual falls into image-fallback.

## When to use which tier

- **Reach for `fully-editable`** when the user wants Slides as a
  collaboration target — every shape stays native, drift is cosmetic.
- **Reach for `hybrid`** for the default round-trip path: most elements
  stay native, only true outliers become images.
- **Reach for `pixel-perfect-visual`** for archival snapshots / pixel-exact
  brand checks where editability is irrelevant.

## Test seams

- `RendererCdpProvider` interface — production wires through
  `@stageflip/renderer-cdp`'s fixture-render pipeline; tests use
  `createStubRenderer({ pngsBySlideId })` returning canned bytes.
- `SlidesMutationClient` interface — production wires through
  `createDefaultMutationClient({ auth })`; tests inject `buildRecordingClient`
  (in `test-helpers.ts`) that records every API call for assertion.
- The convergence loop accepts canned per-iteration observations via
  `RecordingMutationClient.__convergenceObservations` so tests don't have
  to drive a real connected-components diff.

## Non-determinism note

The export is **non-deterministic by nature** — Slides server-side rendering
is the source of variability. Source-level discipline (AC #28) bans
`Date.now`, `Math.random`, `performance.now`, `setTimeout`, `setInterval`
inside `packages/export-google-slides/src/**`; a grep test in
`determinism.test.ts` enforces this.
