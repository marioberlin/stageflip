---
title: Reference — @stageflip/import-google-slides
id: skills/stageflip/reference/import-google-slides
tier: reference
status: substantive
last_updated: 2026-04-27
owner_task: T-244
related:
  - skills/stageflip/workflows/import-google-slides
  - skills/stageflip/concepts/loss-flags
---

# Reference — `@stageflip/import-google-slides`

Foundational Google Slides importer. Output shape mirrors
`@stageflip/import-pptx`'s `parsePptx` — a `CanonicalSlideTree` with slides,
layouts, masters, loss flags, plus a per-slide `pendingResolution` map for
T-246's fallback loop.

## Public surface

```ts
import {
  parseGoogleSlides,
  StubCvProvider,
  HttpCvProvider,
  emitLossFlag,
  CODE_DEFAULTS,
  GoogleApiError,
  CvProviderError,
  resolveAssets,
  gslidesUrlFetcher,
} from '@stageflip/import-google-slides';
import type {
  CanonicalSlideTree,
  ParseGoogleSlidesOptions,
  GoogleAuthProvider,
  CvCandidateProvider,
  CvCandidates,
  CvDetectOptions,
  GSlidesLossFlagCode,
  PendingMatchResolution,
  ParsedAssetRef,
  ParsedElement,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
} from '@stageflip/import-google-slides';
```

### `parseGoogleSlides(opts)`

```ts
function parseGoogleSlides(
  opts: ParseGoogleSlidesOptions,
): Promise<CanonicalSlideTree>;

interface ParseGoogleSlidesOptions {
  presentationId: string;
  auth: GoogleAuthProvider;
  cv: CvCandidateProvider;
  thumbnailSize?: 'SMALL' | 'MEDIUM' | 'LARGE';   // default 'LARGE'
  matchConfidenceThreshold?: number;              // default 0.78
  apiBaseUrl?: string;                            // for tests
  fetchImpl?: typeof fetch;                       // for tests
  presentation?: ApiPresentation;                 // test seam — skip presentations.get
  thumbnails?: Record<string, ...>;               // test seam — skip thumbnail fetches
  cvFixtureKeys?: Record<string, string>;         // test seam — drive StubCvProvider
}
```

Returns a `CanonicalSlideTree` with `assetsResolved: false`. Callers chain
`resolveAssets(tree, gslidesUrlFetcher(), storage)` (re-exported from
`@stageflip/import-pptx`) to upload image bytes.

### `GoogleAuthProvider`

```ts
interface GoogleAuthProvider {
  /** Returns a fresh OAuth access token with `presentations.readonly` scope. */
  getAccessToken(): Promise<string>;
}
```

### `CvCandidateProvider`

```ts
interface CvCandidateProvider {
  detect(pageImage: Uint8Array, opts: CvDetectOptions): Promise<CvCandidates>;
}
```

Two implementations ship:

- `StubCvProvider({ [fixtureKey]: candidates })` — test-only; reads canned
  JSON. The map's values are validated through the same Zod schema the HTTP
  provider uses, so test fixtures and production responses share one
  contract.
- `HttpCvProvider({ workerUrl?, timeoutMs?, fetchImpl? })` — production;
  POSTs the page image as multipart/form-data to `CV_WORKER_URL` (or the
  explicit `workerUrl`), retries on 5xx (3 attempts, 250 / 500 / 1000 ms
  backoff), times out at 60s.

### `CvCandidates` shape

```ts
interface CvCandidates {
  textLines: Array<{
    polygonPx: number[][];
    text: string;
    confidence: number;
  }>;
  contours: Array<{
    bboxPx: { x: number; y: number; width: number; height: number };
    shapeKind: 'rect' | 'rounded-rect' | 'ellipse' | 'polygon';
    fillSample: [number, number, number, number];
    confidence: number;
  }>;
  masks?: Array<{
    bboxPx: { x: number; y: number; width: number; height: number };
    rle?: string;
    confidence: number;
  }>;
}
```

### `GSlidesLossFlagCode`

```ts
type GSlidesLossFlagCode =
  | 'LF-GSLIDES-PADDING-INFERRED'
  | 'LF-GSLIDES-FONT-SUBSTITUTED'
  | 'LF-GSLIDES-IMAGE-FALLBACK'
  | 'LF-GSLIDES-LOW-MATCH-CONFIDENCE'
  | 'LF-GSLIDES-PLACEHOLDER-INLINED'
  | 'LF-GSLIDES-TABLE-MERGE-LOST';
```

`CODE_DEFAULTS` maps each code to `{ severity, category }`. The `emitLossFlag`
wrapper auto-fills `source: 'gslides'`.

### `PendingMatchResolution`

The per-element residual record T-246 reads:

```ts
interface PendingMatchResolution {
  slideId: string;
  elementId: string;
  apiElement: ParsedElement;
  /** bbox slice of the rendered slide PNG covering element bbox + 16-px padding. */
  pageImageCropPx: { x: number; y: number; width: number; height: number };
  rankedCandidates: Array<{
    candidateKind: 'textLine' | 'contour' | 'mask';
    candidateIndex: number;
    contentConfidence: number;
    positionConfidence: number;
    zPenalty: number;
    overallConfidence: number;
  }>;
}
```

### Errors

- `GoogleApiError({ code, httpStatus? })` — `code` ∈ `'AUTH_FAILED' |
  'API_UNAVAILABLE' | 'TIMEOUT' | 'BAD_RESPONSE'`.
- `CvProviderError({ code })` — `code` ∈ `'BAD_RESPONSE' |
  'WORKER_UNAVAILABLE' | 'TIMEOUT'`.

## Determinism

Not in the determinism-restricted scope (CLAUDE.md §3 lists only
`frame-runtime` / `runtimes` / `renderer-core/clips`). Importer determinism
nonetheless matters for round-trip / fixture tests:

- `StubCvProvider` reads candidates from in-memory fixtures; bit-deterministic.
- API-client tests inject a mock `fetch` returning recorded responses
  byte-identically.

Real (non-stubbed) calls to Google's API and the CV worker are
non-deterministic by nature; production accepts this and the loss flags
absorb the divergence into well-typed signals.
