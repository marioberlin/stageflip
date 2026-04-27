---
title: Reference — services/cv-worker (Python CV sidecar)
id: skills/stageflip/reference/cv-worker
tier: reference
status: substantive
last_updated: 2026-04-27
owner_task: T-244
related:
  - skills/stageflip/reference/import-google-slides
  - skills/stageflip/workflows/import-google-slides
  - skills/stageflip/concepts/loss-flags
---

# Reference — `services/cv-worker` (Python CV sidecar)

Python FastAPI service that backs the `CvCandidateProvider` HTTP contract
called by `@stageflip/import-google-slides`'s `HttpCvProvider`. Wraps
PaddleOCR (text-line detection + recognition) and OpenCV (contour + shape
classification) and — when explicitly enabled — SAM 2 (segmentation masks)
behind a single `POST /detect` endpoint.

The service is **infrastructure** for T-244's importer. It does not own the
CvCandidates wire shape; T-244 does, via the Zod validator at
`packages/import-google-slides/src/cv/types.ts`. This service implements
that contract; any change to the response shape is a coordinated change
with T-244.

## HTTP surface

```
POST /detect
Content-Type: multipart/form-data
  image:   <PNG bytes>
  options: <JSON string matching CvDetectOptions>

200 OK   -> CvCandidates JSON
400      -> EMPTY_IMAGE | INVALID_PNG | INVALID_OPTIONS
413      -> PAYLOAD_TOO_LARGE
500      -> PIPELINE_FAILED
```

```
GET /healthz   -> 200 {"status": "ok"}    # Cloud Run liveness probe
```

### Response shape (locked by `cvCandidatesSchema`)

```json
{
  "textLines": [
    { "polygonPx": [[x, y], ...], "text": "Quarterly Revenue", "confidence": 0.97 }
  ],
  "contours": [
    {
      "bboxPx": { "x": int, "y": int, "width": int, "height": int },
      "shapeKind": "rect" | "rounded-rect" | "ellipse" | "polygon",
      "fillSample": [r, g, b, a],
      "confidence": 0.81
    }
  ],
  "masks": [ ... ]    // OMITTED entirely when ENABLE_SAM2 is false
}
```

Coordinates are **integer pixels** in the slide's render-pixel space (T-244
matches against pixels, not normalized 0..1). Sorting is deterministic:
`textLines` by polygon top-left `(y, x)`, `contours` by bbox `(y, x)`.

## Environment variables

| Variable               | Default     | Effect                                                   |
| ---------------------- | ----------- | -------------------------------------------------------- |
| `PORT`                 | `8080`      | Cloud Run-injected.                                      |
| `ENABLE_SAM2`          | `false`     | Truthy enables SAM 2 + the `masks` field.                |
| `MAX_IMAGE_SIZE_BYTES` | `5242880`   | Hard cap on POST image size (5 MB).                      |
| `LOG_LEVEL`            | `INFO`      | Standard Python `logging` name.                          |
| `SAM2_CHECKPOINT`      | `/opt/sam2/sam2_hiera_small.pt` | Path to SAM 2 weights (when enabled). |
| `SAM2_CONFIG`          | `sam2_hiera_s.yaml`             | SAM 2 model config (when enabled).    |

## Pipeline

```
1. Validate image (PNG signature, ≤ MAX_IMAGE_SIZE_BYTES).
2. Decode PNG -> RGBA via Pillow.
3. Run in parallel (ThreadPoolExecutor — both stages release the GIL):
     a. PaddleOCR    -> text-line candidates
     b. OpenCV       -> contour candidates (Canny + dilate + findContours)
     c. SAM 2 (only if ENABLE_SAM2=true) -> mask candidates
4. Compose CvCandidates response, sort each list deterministically.
5. Return JSON.
```

Each stage is independently deterministic on a fixed input — concurrency
changes wall-clock, not output bytes.

## Wire format determinism

Same input image + same `ENABLE_SAM2` value → byte-identical JSON response.
Sources of non-determinism that are pinned:

- PaddleOCR loaded with `use_gpu=False`, `use_angle_cls=False`, no random
  augmentation. Deterministic CPU inference.
- OpenCV uses fixed kernels and thresholds; no random sampling.
- Sort order is `(y, x)` for both candidate lists.

## Container image

Multi-stage Dockerfile. Final image runs as non-root `app` user via
uvicorn. Pinned base: `python:3.11-slim`.

| Configuration                | Image size  |
| ---------------------------- | ----------- |
| PaddleOCR + OpenCV (default) | ~1.5 GB     |
| + SAM 2                      | ~3.5 GB     |

`pnpm check-licenses` does NOT scan Python deps; license verification is a
one-shot manual check at spec time (AC #23 in T-244-cv-worker spec). All
deps fall under `THIRD_PARTY.md` §1's permitted-license set; see
`services/cv-worker/README.md` for the pinned table.

## Deployment

`scripts/deploy-cv-worker.sh` mirrors T-231's pattern:

```bash
GCP_PROJECT_ID=stageflip-prod ./scripts/deploy-cv-worker.sh
```

Cloud Run service flags pinned: `--memory=4Gi --cpu=2 --concurrency=80
--timeout=120 --no-allow-unauthenticated`. The TS-side `HttpCvProvider`'s
bearer-token request is validated by Cloud Run's IAM check before reaching
the container.

Operations procedures (cold-start, alerts, log inspection, rollback) live
in `docs/ops/cv-worker-runbook.md`.

## Integration with `HttpCvProvider`

```ts
// In TS-side caller (e.g. apps/api):
import { HttpCvProvider } from '@stageflip/import-google-slides';

const cv = new HttpCvProvider({
  workerUrl: process.env.CV_WORKER_URL,    // points at this service
  timeoutMs: 60_000,
});

const candidates = await cv.detect(pngBytes, {
  renderWidth: thumbnail.width,
  renderHeight: thumbnail.height,
});
```

`HttpCvProvider` retries on 5xx (3 attempts, 250/500/1000 ms backoff) and
times out at 60s by default. The Zod validator at the boundary throws
`CvProviderError(BAD_RESPONSE)` if this service returns a malformed
response — keep the response shape locked.

## Out of scope

- TypeScript-side changes — T-244 ships `HttpCvProvider`, the validator,
  and the stub. This service is the production server.
- OpenTelemetry / Sentry — deferred to T-264.
- GPU acceleration — CPU is sufficient for v1's slide-import workload.
- Multi-region deployment — single-region (`us-central1`) for v1.
- Batched inference — one slide per request.
- Cold-start optimization (`MIN_INSTANCES=1` is a deployment-time toggle,
  not a service-side change).
