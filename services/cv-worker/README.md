# `services/cv-worker` — StageFlip CV sidecar

Python FastAPI service implementing the `CvCandidateProvider` HTTP contract
called by `@stageflip/import-google-slides`'s `HttpCvProvider`. Wraps
PaddleOCR + OpenCV (and optionally SAM 2) behind a single `POST /detect`
endpoint. Runs on Cloud Run.

The TS-side interface, the wire format, and the Zod validator at the
provider boundary are all owned by T-244. This service is the production
implementation of that contract — it is **not** allowed to deviate from the
shape declared in `packages/import-google-slides/src/cv/types.ts`.

## HTTP surface

```
POST /detect
Content-Type: multipart/form-data

  image:   <PNG bytes>
  options: <JSON string matching CvDetectOptions>

200 OK   -> CvCandidates JSON
400      -> bad input (non-PNG, missing field, malformed options)
413      -> image > MAX_IMAGE_SIZE_BYTES (default 5 MB)
500      -> pipeline failure
```

```
GET /healthz   -> 200 {"status": "ok"}   # Cloud Run liveness probe
```

The strict response shape:

```json
{
  "textLines": [
    {
      "polygonPx": [[x, y], ...],
      "text": "Quarterly Revenue",
      "confidence": 0.97
    }
  ],
  "contours": [
    {
      "bboxPx": {"x": int, "y": int, "width": int, "height": int},
      "shapeKind": "rect" | "rounded-rect" | "ellipse" | "polygon",
      "fillSample": [r, g, b, a],
      "confidence": 0.81
    }
  ],
  "masks": [ ... ]   // OMITTED entirely when ENABLE_SAM2 is false
}
```

## Environment variables

| Variable               | Default     | Effect                                                   |
| ---------------------- | ----------- | -------------------------------------------------------- |
| `PORT`                 | `8080`      | Cloud Run injects this; uvicorn binds to `0.0.0.0:$PORT`. |
| `ENABLE_SAM2`          | `false`     | When truthy, enables SAM 2 mask inference + `masks` key. |
| `MAX_IMAGE_SIZE_BYTES` | `5242880`   | Hard limit on POST `image` size (5 MB).                  |
| `LOG_LEVEL`            | `INFO`      | Standard Python `logging` level name.                    |
| `SAM2_CHECKPOINT`      | `/opt/sam2/sam2_hiera_small.pt` | SAM 2 weights path (only when enabled). |
| `SAM2_CONFIG`          | `sam2_hiera_s.yaml`             | SAM 2 model config (only when enabled). |

## Local development

```bash
cd services/cv-worker
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app:app --reload --port 8080
```

In another terminal:

```bash
curl -X POST http://localhost:8080/detect \
  -F "image=@tests/fixtures/single-rect.png" \
  -F 'options={"renderWidth": 320, "renderHeight": 180}'
```

To wire `apps/api` (or any TS-side caller) at the local sidecar:

```bash
export CV_WORKER_URL=http://localhost:8080/detect
```

## Running the tests

```bash
cd services/cv-worker
pip install -r requirements-dev.txt
pytest -ra
```

The default test run **does not** exercise PaddleOCR or SAM 2 directly —
those stages are stubbed via `monkeypatch` so the suite runs in seconds and
doesn't pull the 200 MB OCR model cache. To exercise PaddleOCR end-to-end:

```bash
PADDLEOCR_INSTALLED=1 pytest tests/test_pipeline.py::test_paddleocr_recognizes_text
```

## Building the Docker image

```bash
docker build -t cv-worker:dev services/cv-worker/
docker run --rm -p 8080:8080 -e ENABLE_SAM2=false cv-worker:dev
```

The image is multi-stage (`builder` + `runtime`); the final image runs as a
non-root `app` user. Expected size:

| Configuration             | Image size  |
| ------------------------- | ----------- |
| PaddleOCR + OpenCV        | ~1.5 GB     |
| + SAM 2 (`ENABLE_SAM2=true`) | ~3.5 GB     |

## Deployment

`scripts/deploy-cv-worker.sh` mirrors the T-231 Cloud Run deployment pattern.

```bash
GCP_PROJECT_ID=stageflip-prod ./scripts/deploy-cv-worker.sh
```

Required:

- `GCP_PROJECT_ID` — target project. Script fail-fasts when unset.

Optional overrides:

- `GCP_REGION` (default `us-central1`)
- `GCP_REPO` (default `stageflip` — Artifact Registry repo)
- `SERVICE_NAME` (default `stageflip-cv-worker`)
- `ENABLE_SAM2` (default `false`)
- `MIN_INSTANCES` (default `0` — cost-optimized; raise to `1` for warm cold starts)
- `MAX_INSTANCES` (default `10`)

Cloud Run service flags pinned in the script:

- `--memory=4Gi --cpu=2`
- `--concurrency=80`
- `--timeout=120`
- `--no-allow-unauthenticated` (IAM-bound; the TS-side `HttpCvProvider`'s
  bearer token is validated by Cloud Run)

## SAM 2 (opt-in)

SAM 2 is **disabled by default**. To enable:

1. Add `sam2==1.0` to `requirements.txt` and rebuild the image (size grows
   by ~2 GB).
2. Mount or bake the SAM 2 weights into `/opt/sam2/sam2_hiera_small.pt`.
3. Deploy with `ENABLE_SAM2=true`.

The HTTP response's `masks` field stays optional under both modes — flipping
the env var does NOT break TS-side consumers.

## License posture

All Python deps fall under `THIRD_PARTY.md` §1's permitted-license set:

| Package                  | Version    | License        |
| ------------------------ | ---------- | -------------- |
| `paddleocr`              | 2.10.0     | Apache-2.0     |
| `paddlepaddle` (CPU)     | 2.6.2      | Apache-2.0     |
| `opencv-python-headless` | 4.10.0.84  | Apache-2.0     |
| `numpy`                  | 1.26.4     | BSD-3-Clause   |
| `pillow`                 | 10.4.0     | HPND (PIL)     |
| `fastapi`                | 0.115.0    | MIT            |
| `uvicorn[standard]`      | 0.30.6     | BSD-3-Clause   |
| `python-multipart`       | 0.0.10     | Apache-2.0     |
| `sam2` (optional)        | 1.0        | Apache-2.0     |

The TS-side `pnpm check-licenses` gate does NOT scan Python deps; this list
is the manual one-shot verification per AC #23. Re-verify when bumping
versions.

See also `docs/ops/cv-worker-runbook.md` for operations + on-call procedures.
