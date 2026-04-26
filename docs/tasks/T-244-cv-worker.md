---
title: T-244-cv-worker — Python CV sidecar (PaddleOCR + OpenCV + SAM 2) for the Slides import pipeline
id: docs/tasks/T-244-cv-worker
phase: 11
size: S
owner_role: implementer
status: draft
last_updated: 2026-04-26
---

# T-244-cv-worker — Python CV sidecar for the Slides import pipeline

**Branch**: `task/T-244-cv-worker`

## Goal

Ship the **production implementation** of the `CvCandidateProvider` HTTP contract that T-244's `HttpCvProvider` (in `@stageflip/import-google-slides/src/cv/http.ts`) calls. T-244 ships only the TS interface + a stub provider for tests; the production CV stack — PaddleOCR + OpenCV + (optional) SAM 2 — was deferred to this task per T-244 spec §"Out of scope" §3:

> The Python CV sidecar's deployment | A follow-on infrastructure task (call it T-244-cv-worker). T-244 ships the `CvCandidateProvider` interface plus a stub provider for unit tests; the production provider (HTTP client to a Cloud Run service hosting PaddleOCR / OpenCV / SAM 2) lands separately so spec-time CI doesn't have to build a 5GB image.

T-244-cv-worker is **infrastructure-only** — no TypeScript code in this PR. It ships:

- A Python service (`services/cv-worker/`) that wraps PaddleOCR + OpenCV + SAM 2 behind an HTTP endpoint matching T-244's `CvCandidateProvider` request/response contract.
- A Dockerfile producing a Cloud Run-deployable image.
- A deployment script (`scripts/deploy-cv-worker.sh`) wiring the container to the project's Google Cloud project per T-231's pattern.
- Integration test fixtures matching the canned `CvCandidates` JSON shape T-244 already pins.

The TS-side `HttpCvProvider` and the `CvCandidates` Zod validator are **already shipped in T-244**; this PR just stands up the server it talks to.

## Dependencies

- **T-244 implementation** merged. T-244's spec §4 + §"Public surface" defines:
  - The `CvCandidates` JSON shape (textLines / contours / masks).
  - The `CvDetectOptions` request shape.
  - The `HttpCvProvider`'s POST endpoint expectations (multipart form-data with `image` bytes + JSON `options`).
  - The Zod validator at the response boundary.
- **T-231 merged** (Cloud Run render worker deployment). Provides the deployment infrastructure pattern T-244-cv-worker reuses (project config, service-account binding, region selection).
- `gcloud` CLI installed in the deployment environment.
- A Google Cloud project with Cloud Run + Container Registry enabled.

**Does NOT depend on**: T-245 (rasterize), T-246 (AI-QC), T-252 (export), T-253-rider, T-247.

**Blocks**: nothing structural. T-244 already ships and works with the stub provider; T-244-cv-worker only enables the production HTTP-backed provider.

## Out of scope

| Item | Why deferred |
|---|---|
| TypeScript-side changes | T-244 already ships `HttpCvProvider`, the Zod validator, and the canned-fixture stub provider. T-244-cv-worker only stands up the server. |
| Per-deployment monitoring | Cloud Run's default metrics (request count, p50/p99 latency, error rate) are sufficient for v1. Telemetry deferred to T-264 (OpenTelemetry, Phase 12). |
| Auto-scaling tuning | Cloud Run's default concurrency (80 requests / instance) and CPU allocation (1 vCPU) are reasonable starting points; tuning happens after observing real load. |
| GPU acceleration | PaddleOCR + OpenCV + SAM 2 all run on CPU adequately for slide-import workloads (target latency ~3-5 s / slide). GPU instances cost ~5x more; deferred until proven CPU is the bottleneck. |
| SAM 2 inclusion in v1 | SAM 2 (Segment Anything 2) is **optional** per T-244 spec §"Architectural decisions" §4. v1 ships PaddleOCR + OpenCV; SAM 2 is a follow-on commit when the deterministic-matching false-negative rate justifies the +2 GB image size. The HTTP response shape's `masks` field stays optional. |
| Cold-start optimization | Cloud Run's cold-start is ~3-10 s for a 1-2 GB image. Min-instances = 1 (always-warm) is a deployment-time setting; v1 starts with min-instances = 0 (cost-optimized). |
| Multi-region deployment | v1 deploys to one region (default `us-central1`). EU residency for GDPR is a future task (T-271). |
| Authentication beyond the default Cloud Run IAM | T-244's TS-side auth provider sends a Google bearer token; Cloud Run validates via IAM. Custom auth (per-tenant API keys, etc.) is out of scope. |
| Horizontal/distributed inference | Single-process inference per request. Batch inference (multiple slides per request) deferred. |

## Architectural decisions

### 1. Service surface

```
POST /detect
Content-Type: multipart/form-data

Form fields:
  image: <PNG bytes — the slide thumbnail T-244's HttpCvProvider passes>
  options: <JSON string matching CvDetectOptions — at minimum, the field T-244 spec carries>

Response:
  200 OK
  Content-Type: application/json
  Body: <JSON matching CvCandidates — { textLines, contours, masks }>

Error responses:
  400 Bad Request — input validation (e.g., non-PNG bytes)
  413 Payload Too Large — image > 5 MB
  500 Internal Server Error — inference failure
  503 Service Unavailable — cold start or overload
```

The exact request + response shapes are spec'd by T-244 spec §4 + §"Public surface"; this task implements the server side without redefining them.

### 2. Pipeline composition

For each request:

```
1. Validate input — PNG signature + size limit (5 MB).
2. Decode PNG bytes via Pillow (PIL).
3. Run PaddleOCR detection — outputs text-line polygons + recognized text + confidence.
4. Run OpenCV connected-components + findContours — outputs shape regions with sampled fill colors.
5. (Optional, if SAM 2 enabled) Run SAM 2 mask inference — outputs RLE masks for non-textual non-rectangular regions.
6. Format response per CvCandidates JSON shape — coordinates already in pixel space (no normalization needed; T-244's matching layer expects px).
7. Return JSON.
```

Steps 3-5 are independent and can run in parallel via Python's `concurrent.futures.ThreadPoolExecutor` (PaddleOCR and OpenCV release the GIL during their inference calls, so threading is fine).

### 3. Container image

Base image: `python:3.11-slim` (Debian-based; Apache-2.0).

Pinned dependencies (`requirements.txt`):

```
paddleocr==2.10.0           # Apache-2.0
paddlepaddle==2.6.2         # Apache-2.0 (CPU build)
opencv-python-headless==4.10.0.84   # Apache-2.0 (since 4.5.0)
numpy==1.26.4               # BSD-3-Clause
pillow==10.4.0              # PIL Software License (MIT-like, on workspace whitelist)
fastapi==0.115.0            # MIT
uvicorn==0.30.6             # BSD-3-Clause
python-multipart==0.0.10    # Apache-2.0
# Optional, controlled by ENABLE_SAM2 env var:
# sam2==1.0                 # Apache-2.0
```

Image size with PaddleOCR + OpenCV is ~1.5 GB; adding SAM 2 brings it to ~3.5 GB.

### 4. Deployment script (`scripts/deploy-cv-worker.sh`)

Mirrors T-231's pattern:

```bash
#!/bin/bash
set -euo pipefail
PROJECT_ID="${GCP_PROJECT_ID:?required}"
REGION="${GCP_REGION:-us-central1}"
SERVICE="cv-worker"
IMAGE_TAG="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/stageflip-services/${SERVICE}:${IMAGE_TAG}"

docker build -t "${IMAGE_URI}" services/cv-worker/
docker push "${IMAGE_URI}"

gcloud run deploy "${SERVICE}" \
  --image="${IMAGE_URI}" \
  --region="${REGION}" \
  --platform=managed \
  --memory=4Gi \
  --cpu=2 \
  --concurrency=80 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=120 \
  --no-allow-unauthenticated
```

The `--no-allow-unauthenticated` flag enforces IAM-bound access; the TS-side `HttpCvProvider` includes a Google bearer token in its `Authorization` header per T-244's spec.

### 5. Environment variables

- `ENABLE_SAM2` (default `false`): toggles SAM 2 loading + the optional `masks` array in responses.
- `MAX_IMAGE_SIZE_BYTES` (default `5242880` = 5 MB): hard limit on input PNG size.
- `PORT` (default `8080`): set by Cloud Run automatically.

### 6. Testing

The Python service ships its own pytest suite:

- `test_pipeline.py` — unit tests for each pipeline stage with canned PNG inputs (small fixture PNGs in `services/cv-worker/tests/fixtures/`).
- `test_response_shape.py` — verifies the JSON response matches the `CvCandidates` shape exactly (parsed against a Python TypedDict mirroring T-244's TS interface).
- `test_integration.py` — end-to-end: HTTP POST with a fixture image → asserts response shape.

The TS side already has integration tests via `HttpCvProvider`'s mocked-fetch; T-244-cv-worker doesn't add TS tests.

### 7. Local development workflow

```bash
cd services/cv-worker
pip install -r requirements.txt
ENABLE_SAM2=false uvicorn app:app --reload --port 8080

# In another terminal:
curl -X POST http://localhost:8080/detect \
  -F "image=@tests/fixtures/sample-slide.png" \
  -F 'options={"detectText": true, "detectShapes": true}'
```

The TS-side `HttpCvProvider` reads `CV_WORKER_URL` from env; setting `CV_WORKER_URL=http://localhost:8080/detect` lets `apps/api` test against a local sidecar.

## Files to create / modify

```
services/cv-worker/                             # NEW directory
  app.py                                        # FastAPI entrypoint
  pipeline/
    __init__.py
    paddle.py                                   # PaddleOCR wrapper
    opencv.py                                   # OpenCV contours + connected-components
    sam2.py                                     # SAM 2 wrapper (gated by ENABLE_SAM2)
    compose.py                                  # parallel pipeline orchestrator
  schemas.py                                    # Python TypedDicts mirroring CvCandidates / CvDetectOptions
  requirements.txt                              # pinned deps
  Dockerfile                                    # multi-stage build
  .dockerignore
  pyproject.toml                                # for ruff/black formatting
  README.md                                     # deployment + local-dev instructions
  tests/
    __init__.py
    test_pipeline.py
    test_response_shape.py
    test_integration.py
    fixtures/
      sample-slide.png                          # ~150 KB hand-built fixture
      sample-slide-with-text.png
      sample-slide-shapes-only.png
      expected-candidates.json                  # for cross-validation against TS-side fixtures

scripts/
  deploy-cv-worker.sh                           # NEW — Cloud Run deploy script

skills/stageflip/
  reference/
    cv-worker/
      SKILL.md                                  # NEW — deployment + invocation reference

docs/
  ops/
    cv-worker-runbook.md                        # NEW — operations runbook (cold-start tuning, log inspection, on-call alerts)
```

No changes to:
- `packages/import-google-slides/` — T-244 already ships the TS-side HttpCvProvider + Zod validator + stub.
- `package.json` / `pnpm-lock.yaml` — Python service is independent of the TS workspace.
- `THIRD_PARTY.md` — Python deps are vendored as service-side; not workspace runtime deps. They're documented in `services/cv-worker/requirements.txt` (which `pnpm check-licenses` does NOT scan since it's outside `package.json`).

## Acceptance criteria

Each gets a Python pytest test (or shell test as applicable), written first and failing.

### HTTP surface

1. `POST /detect` with a valid PNG returns `200 OK` + JSON matching the `CvCandidates` shape (`{textLines, contours}` non-null arrays; `masks` present only when `ENABLE_SAM2=true`). Pin via fixture.
2. `POST /detect` with non-PNG bytes returns `400 Bad Request`. Pin.
3. `POST /detect` with a PNG > 5 MB returns `413 Payload Too Large`. Pin.
4. `POST /detect` without the `image` form field returns `400`. Pin.
5. `POST /detect` with malformed `options` JSON returns `400`. Pin.

### PaddleOCR pipeline

6. A fixture image with a single horizontal text line ("Quarterly Revenue") produces `textLines.length === 1` with `text === 'Quarterly Revenue'` and `polygonPx` matching the rendered text bbox within ±5 px tolerance. Pin via fixture.
7. A fixture image with multiple text lines produces N entries in `textLines`. Pin.
8. A fixture image with no text produces `textLines === []` and an OK 200 response. Pin.

### OpenCV pipeline

9. A fixture image with a single solid rectangle produces `contours.length >= 1` with `shapeKind: 'rect'` matching the rectangle's bbox. Pin via fixture.
10. A fixture image with a circle produces a contour with `shapeKind: 'ellipse'`. Pin.
11. `fillSample` on a contour matches the source pixel color within ±5 RGBA components. Pin.

### Response shape

12. The JSON response parses cleanly against a Python TypedDict mirroring T-244's TS `CvCandidates` interface. Pin via test that imports both the Python schema and a hand-mirrored TS interface description.
13. Coordinates in `polygonPx` and `bboxPx` are integers in pixel space (not normalized 0-1 floats). Pin.

### SAM 2 (when enabled)

14. With `ENABLE_SAM2=true`, the response includes `masks` (possibly empty array) with each entry having `bboxPx` + optional `rle`. Pin.
15. With `ENABLE_SAM2=false`, the response omits `masks` entirely (key not present) — the TS-side optional field handles both. Pin.

### Container image

16. `docker build services/cv-worker/` succeeds and produces an image < 4 GB (with SAM 2 enabled) or < 2 GB (without). Pin via shell test in CI.
17. The container starts and serves a health check at `GET /healthz` returning `200 OK` with body `{"status": "ok"}`. Pin via integration test.

### Deployment

18. `scripts/deploy-cv-worker.sh` is executable and uses `set -euo pipefail`. Pin via shellcheck.
19. The script reads required env vars (`GCP_PROJECT_ID`) and fails-fast with a clear error when missing. Pin.
20. The script's `gcloud run deploy` invocation includes the documented flags (`--memory=4Gi`, `--cpu=2`, etc.). Pin via `--dry-run` snapshot.

### Cross-validation with TS side

21. The Python `expected-candidates.json` fixture matches one of T-244's TS-side CV-candidates fixtures byte-for-byte (modulo float-formatting whitespace). Pin via cross-fixture test.

### Operations runbook

22. `docs/ops/cv-worker-runbook.md` documents:
    - Cold-start expected duration (3-10 s)
    - Memory/CPU allocation rationale
    - On-call alert thresholds (p99 > 30 s; error rate > 5%)
    - Log inspection commands (`gcloud logging read ...`)
    - Re-deployment procedure
    Pin via skill-drift-style content checklist.

### License posture

23. All Python deps' licenses are in the permitted set per `THIRD_PARTY.md` §1. Pin via a `requirements.txt`-scanning shell test that checks each pinned version's PyPI metadata. **Note**: this is a one-shot manual verification at spec time; ongoing license-checking for Python deps is OOS. The `pnpm check-licenses` workspace gate does NOT scan Python deps.

## Public-spec / library references

- **T-244 spec** (`docs/tasks/T-244.md`):
  - §"Architectural decisions" §4 — the `CvCandidateProvider` interface this server implements.
  - §"Public surface" — the `CvCandidates` JSON shape.
  - §"Out of scope" §3 — the explicit deferral that creates this task.
- **PaddleOCR**: https://github.com/PaddlePaddle/PaddleOCR (Apache-2.0). Version 2.10.0 pinned.
- **OpenCV**: https://github.com/opencv/opencv-python (Apache-2.0 since 4.5.0). Version 4.10.0.84 pinned.
- **SAM 2**: https://github.com/facebookresearch/sam2 (Apache-2.0). Optional; deferred to a follow-on commit per §"Out of scope".
- **FastAPI**: https://github.com/tiangolo/fastapi (MIT).
- **Cloud Run service deployment** (T-231 pattern): see `scripts/deploy-render-worker.sh` (already on `main` from T-231).
- **In-repo precedents**:
  - `packages/import-google-slides/src/cv/http.ts` — the TS-side client whose `CV_WORKER_URL` env var points at this service.
  - `packages/import-google-slides/src/cv/types.ts` — the canonical `CvCandidates` interface.
  - `services/render-worker/` (from T-231) — the existing Cloud Run service whose Dockerfile + deployment script T-244-cv-worker mirrors.

## Skill updates (in same PR)

- `skills/stageflip/reference/cv-worker/SKILL.md` (NEW) — package reference: HTTP endpoint, environment variables, deployment, integration with `HttpCvProvider`. Lives in `reference/` (not `workflows/`) because it's an infrastructure component, not a workflow agents follow.

## Quality gates (block merge)

The TS-side gates are all n/a (no TS code in this PR). Python-side gates:

- **Python tests** (`pytest services/cv-worker/`): all green.
- **Container build** (CI): `docker build services/cv-worker/` succeeds.
- **Image-size budget**: < 2 GB without SAM 2; < 4 GB with SAM 2. Pin via CI step.
- **Shellcheck** on `scripts/deploy-cv-worker.sh`: green.
- **`pnpm check-skill-drift`**: the new SKILL.md exists at `skills/stageflip/reference/cv-worker/SKILL.md`.

The CI pipeline must be extended to run pytest + Docker build for the new service. Add a separate CI job rather than pulling Python into the existing TS-only pipeline.

No `pnpm typecheck` / `pnpm lint` / `pnpm test` runs on Python sources. No new TS deps; `pnpm check-licenses` runs unchanged on the existing TS workspace.

## PR template + commit

- Title: `[T-244-cv-worker] services/cv-worker — Python CV sidecar (PaddleOCR + OpenCV)`
- Conventional commits:
  - Commit 1: `test(cv-worker): T-244-cv-worker — failing pytest suite + fixtures + Dockerfile scaffolding`
  - Commit 2: `feat(cv-worker): T-244-cv-worker — FastAPI app + PaddleOCR + OpenCV pipeline`
  - Commit 3: `feat(cv-worker): T-244-cv-worker — deployment script + runbook + skill`
  - Optional Commit 4 for non-blocking Reviewer feedback.
- Branch: `task/T-244-cv-worker`
- Changesets: **none** — no publishable TS package touched.

## Escalation triggers (CLAUDE.md §6)

Stop and report instead of guessing if:

- A pinned Python dep's PyPI metadata reports a license outside the workspace's permitted set (e.g., a transitive dep is GPL-3.0). Investigate; pin a pre-GPL version or escalate.
- The container image size exceeds the budget (4 GB with SAM 2). Cloud Run has hard limits (~10 GB total deployment package); approaching the budget means either reducing dep set or switching to GPU-class instances. Escalate before crossing 4 GB.
- The pipeline's per-request latency exceeds 10 seconds at idle (cold-start excluded). Cloud Run charges by request-time; > 10s means the deterministic-matcher's threshold (T-244 spec, default 0.78) might need adjustment, OR the pipeline needs a slow-path fallback. Escalate.
- PaddleOCR detection fails on a known-clean fixture (text exists, model returns empty array). Pin the model version + verify; if it's a real regression, escalate before silently shrinking the test set.
- Cloud Run's IAM-bound auth interferes with the TS-side `HttpCvProvider`'s bearer-token approach (e.g., the bearer token is rejected by Cloud Run's identity check). Escalate; the auth flow may need a different shape than T-244 spec'd.

## Notes for the Orchestrator

1. **S-sized; expect three commits.** The pipeline composition is mechanical; the FastAPI surface + Dockerfile + deployment script are well-known patterns. Reviewer should focus on AC #21 (cross-validation with TS-side fixtures) and AC #16 (image-size budget).
2. **No TypeScript in this PR.** The TS-side is already shipped in T-244. T-244-cv-worker stands up the production server.
3. **CI extension required.** The existing CI is TS-only (Turbo + pnpm). Add a separate job that runs pytest + docker build for this service — likely a parallel GitHub Actions workflow file in `.github/workflows/cv-worker.yml`. Implementer should call out the CI-extension scope in the PR description.
4. **SAM 2 is opt-in.** v1 ships PaddleOCR + OpenCV only. SAM 2 lands as a follow-on commit (or a follow-on PR) when the deterministic-matching false-negative rate justifies the +2 GB image size. The HTTP response's `masks` field stays optional, so flipping the env var doesn't break clients.
5. **Operational concerns deferred.** OpenTelemetry / Sentry observability lands in T-264 (Phase 12). Cloud Run's default metrics + logs are sufficient for v1.
6. **Multi-region is OOS.** EU residency for GDPR is T-271. v1 single-region (`us-central1`) deployment.
7. **Dispatch convention** (this session): foreground Implementer, no `isolation: worktree`. **However** — this task is mostly Python + infrastructure files; the CLAUDE.md hard rules around determinism / license whitelist / no-`console.log` apply only to TS sources, so the Python side is governed by `pyproject.toml` ruff/black rather than biome. Implementer should still respect file headers + clear naming conventions.
8. **Plan-row update**: T-244-cv-worker is a sub-task of T-244 named in T-244 spec §"Out of scope" §3. The plan-row at `docs/implementation-plan.md:532` does NOT list it as a separate row — it's a "follow-on infrastructure task" carried forward to deployment. Implementer should add an explicit plan-row for visibility, OR leave it as a sub-task carried by T-244's row. **Decision**: add a plan-row for visibility (mirrors T-243-storage-adapter at line 529), so future readers know this exists as a tracked task.
