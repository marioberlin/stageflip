---
title: Reference — @stageflip/export-google-slides
id: skills/stageflip/reference/export-google-slides
tier: reference
status: substantive
last_updated: 2026-04-27
owner_task: T-252
related:
  - skills/stageflip/workflows/export-google-slides
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/reference/import-google-slides
  - skills/stageflip/reference/rasterize
---

# Reference — `@stageflip/export-google-slides`

Render-diff convergence loop writer for Google Slides. Inverse of
`@stageflip/import-google-slides`'s `parseGoogleSlides`. Peer of
`@stageflip/export-pptx`.

## Public surface

```ts
import { exportGoogleSlides } from '@stageflip/export-google-slides';
import type {
  ExportGoogleSlidesOptions,
  ExportGoogleSlidesResult,
  ExportTier,
  ConvergenceTolerances,
  RendererCdpProvider,
  GSlidesExportLossFlagCode,
} from '@stageflip/export-google-slides';

const result: ExportGoogleSlidesResult = await exportGoogleSlides(doc, opts);
// result.presentationId  : string
// result.lossFlags       : LossFlag[]
// result.outcomes        : SlideExportOutcome[]
// result.apiCallsMade    : number
```

## `ExportGoogleSlidesOptions`

| Field | Default | Purpose |
|---|---|---|
| `auth: GoogleAuthProvider` | required | OAuth token provider — same shape as T-244's. |
| `presentationId?: string` | undefined | Existing presentation to overwrite. Undefined → create new. |
| `renderer: RendererCdpProvider` | required | Produces the canonical-side golden PNGs for the diff. |
| `tier?: ExportTier` | `'hybrid'` | One of `'fully-editable'` / `'hybrid'` / `'pixel-perfect-visual'`. |
| `maxIterations?: number` | `3` | Convergence loop iteration cap (clamped per tier). |
| `apiBaseUrl?: string` | `https://slides.googleapis.com/v1` | Override for testing. |
| `tolerances?: Partial<ConvergenceTolerances>` | `DEFAULT_TOLERANCES` | Per-tolerance overrides. |
| `apiClient?: SlidesMutationClient` | `createDefaultMutationClient(auth)` | Test seam — inject a recording client. |

## `RendererCdpProvider`

```ts
interface RendererCdpProvider {
  renderSlide(
    doc: Document,
    slideId: string,
    sizePx: { width: number; height: number },
  ): Promise<Uint8Array>;
}
```

Production wires through `@stageflip/renderer-cdp`'s fixture-render
pipeline (the same one used by `pnpm parity` and the slide app's e2e).
The package ships `createStubRenderer({ pngsBySlideId })` for tests.

## `ExportTier`

```ts
type ExportTier = 'fully-editable' | 'hybrid' | 'pixel-perfect-visual';
```

| Mode | Convergence | Image-fallback | Editability |
|---|---|---|---|
| `fully-editable` | none | none | maximum |
| `hybrid` (default) | up to `maxIterations` | residuals only | high |
| `pixel-perfect-visual` | clamped to 1 iteration | every element | minimum |

## `ConvergenceTolerances`

```ts
interface ConvergenceTolerances {
  textBboxPositionPx: number;   // default 2
  textBboxSizePx: number;       // default 3
  imageShapePx: number;         // default 1
  perceptualDiffThreshold: number; // default 0.02 (2%)
}
```

Defaults exported as `DEFAULT_TOLERANCES`.

## `SlideExportOutcome`

```ts
interface SlideExportOutcome {
  slideId: string;
  iterations: number;          // 0 for fully-editable, 1..maxIterations otherwise
  residualCount: number;       // number of elements that fell into image-fallback
  finalMetrics: {
    textBboxPx: number;        // max text bbox drift observed
    imageShapePx: number;      // max shape/image drift observed
    perceptualDiffPct: number; // [0,1] whole-slide perceptual diff
  };
}
```

## `GSlidesExportLossFlagCode`

```ts
type GSlidesExportLossFlagCode =
  | 'LF-GSLIDES-EXPORT-FALLBACK'
  | 'LF-GSLIDES-EXPORT-API-ERROR'
  | 'LF-GSLIDES-EXPORT-CONVERGENCE-STALLED'
  | 'LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED'
  | 'LF-GSLIDES-EXPORT-NOTES-DROPPED'
  | 'LF-GSLIDES-EXPORT-FONT-SUBSTITUTED'
  | 'LF-GSLIDES-EXPORT-TABLE-ROTATION-LOST'
  | 'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED';
```

All flags carry `source: 'gslides'` (reuses T-244's source value). The
default severity + category bound to each code lives in `loss-flags.ts`'s
`CODE_DEFAULTS` table.

## `SlidesMutationClient`

The mutation surface T-252 needs. Subset:

```ts
interface SlidesMutationClient {
  createPresentation(opts: { title?: string }): Promise<CreatePresentationResponse>;
  batchUpdate(opts: {
    presentationId: string;
    requests: BatchUpdateRequest[];
  }): Promise<BatchUpdateResponse>;
  driveFilesCreate(opts: {
    bytes: Uint8Array;
    mimeType: 'image/png';
    name?: string;
  }): Promise<DriveFileCreateResponse>;
  fetchSlideThumbnail(opts: {
    presentationId: string;
    slideObjectId: string;
  }): Promise<{ bytes: Uint8Array; width: number; height: number }>;
}
```

Hand-rolled (no `googleapis` dep) per T-244's accepted precedent — saves
~3 MB of transitive surface.

## Plan emission preference order

1. **`UpdateShapePropertiesRequest`** when `inheritsFrom` resolves to a
   layout/master placeholder.
2. **`DuplicateObjectRequest` + modifications** when a similar object
   exists on the target slide (same kind, bbox center within 50 px,
   text 80% Levenshtein-similar).
3. **`CreateShapeRequest` / `CreateImageRequest` / `CreateTableRequest`**
   from scratch.

## Image-fallback contract

Residuals → `rasterizeFromThumbnail(goldenPng, bbox, { paddingPx: 0 })`
→ `drive.files.create` → `DeleteObjectRequest` + `CreateImageRequest`.

Group residuals: ONE `DeleteObjectRequest` against the group's objectId
deletes the group AND its children (Slides cascades). Never emit per-child
deletes.

## Testing helpers

- `createStubRenderer({ pngsBySlideId })` — canned PNG renderer.
- `buildRecordingClient(opts?)` — recording mutation client for assertions.
  Test seam `__convergenceObservations` lets tests inject canned per-iteration
  diffs.

## Round-trip with T-244

`exportGoogleSlides ∘ parseGoogleSlides` produces a `Document` structurally
equal under the §10 predicate (animations dropped, notes dropped,
image-fallback elements as `ImageElement`).
