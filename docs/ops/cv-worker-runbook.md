# Operations Runbook — `services/cv-worker`

Cloud Run-hosted Python sidecar for the Slides import CV pipeline.

## Service identity

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| Cloud Run service | `stageflip-cv-worker`                                         |
| Region (v1)       | `us-central1`                                                 |
| Auth              | `--no-allow-unauthenticated` (IAM-bound; bearer-token via Cloud Run) |
| Source            | `services/cv-worker/`                                         |
| Image registry    | `${REGION}-docker.pkg.dev/${PROJECT}/stageflip/stageflip-cv-worker` |

## Cold-start expectations

| Configuration                  | Cold-start (p50) | Cold-start (p99) |
| ------------------------------ | ---------------- | ---------------- |
| PaddleOCR + OpenCV (default)   | ~3 s             | ~6 s             |
| + SAM 2 (`ENABLE_SAM2=true`)   | ~7 s             | ~12 s            |

`MIN_INSTANCES=0` (the default) means the first request after idle pays the
full cold-start. To eliminate cold starts at the cost of always-on billing,
redeploy with `MIN_INSTANCES=1`.

## Memory + CPU rationale

- **`--memory=4Gi`**: PaddleOCR's detection + recognition models load
  ~1.2 GB resident; OpenCV + numpy buffers add ~200 MB; SAM 2 (when
  enabled) adds ~1.5 GB. 4 GiB leaves headroom for concurrent requests.
- **`--cpu=2`**: PaddleOCR + OpenCV are CPU-bound and release the GIL during
  inference; 2 vCPUs lets the orchestrator run text + shape detection in
  parallel.
- **`--concurrency=80`**: Cloud Run's default. Each request uses ~50 MB of
  per-request memory on top of the model resident set, so 80 in-flight
  requests at 50 MB ≈ 4 GiB — at the edge of the memory budget. If memory
  pressure shows in production logs, drop concurrency to 40.

## On-call alert thresholds

Configure these in Cloud Monitoring against the service's request metrics:

| Signal               | Threshold                | Action                                   |
| -------------------- | ------------------------ | ---------------------------------------- |
| p99 latency          | > 30 s sustained 5 min   | Page primary on-call                     |
| Error rate (5xx)     | > 5% over 5 min          | Page primary on-call                     |
| Cold-start frequency | > 10 / minute            | Investigate; consider `MIN_INSTANCES=1`  |
| Memory utilization   | > 80% sustained          | Drop concurrency or raise memory         |
| Container instance count | == `--max-instances`  | Scale `MAX_INSTANCES` or capacity-plan   |

## Log inspection

```bash
# Tail recent logs
gcloud logging read \
  'resource.type="cloud_run_revision"
   resource.labels.service_name="stageflip-cv-worker"
   severity>=WARNING' \
  --project=$GCP_PROJECT_ID \
  --limit=100 \
  --format='value(timestamp,textPayload)'

# Filter to a specific request id (the Cloud Run trace header)
gcloud logging read \
  'resource.type="cloud_run_revision"
   resource.labels.service_name="stageflip-cv-worker"
   trace="projects/${GCP_PROJECT_ID}/traces/${TRACE_ID}"' \
  --project=$GCP_PROJECT_ID
```

The service logs at `INFO` by default. Set `LOG_LEVEL=DEBUG` via Cloud Run
revision env vars when investigating individual requests.

## Common error codes (response body `code` field)

| Code                | Meaning                                | Action                                |
| ------------------- | -------------------------------------- | ------------------------------------- |
| `EMPTY_IMAGE`       | `image` form field empty               | Caller bug; check upstream            |
| `INVALID_PNG`       | Bytes don't decode as PNG              | Caller sent non-PNG / corrupted bytes |
| `PAYLOAD_TOO_LARGE` | Image exceeds `MAX_IMAGE_SIZE_BYTES`   | Caller bug or oversized thumbnail     |
| `INVALID_OPTIONS`   | `options` is not a JSON object         | Caller bug                            |
| `PIPELINE_FAILED`   | PaddleOCR / OpenCV / SAM 2 raised      | Investigate logs; likely model issue  |

## Re-deployment procedure

### Standard rollout (matches `scripts/deploy-cv-worker.sh`)

```bash
git checkout main
git pull
GCP_PROJECT_ID=stageflip-prod ./scripts/deploy-cv-worker.sh
```

The script tags the image with `${YYYYMMDD-HHMMSS}-${git-sha}` and deploys
a new revision. Cloud Run keeps the previous revision; traffic shifts 100%
to the new revision automatically.

### Rollback

```bash
# List revisions
gcloud run revisions list \
  --service=stageflip-cv-worker \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID

# Pin traffic to a specific revision
gcloud run services update-traffic stageflip-cv-worker \
  --region=us-central1 \
  --project=$GCP_PROJECT_ID \
  --to-revisions=stageflip-cv-worker-00012-abc=100
```

### Enabling SAM 2 (one-time)

1. Edit `requirements.txt` to add `sam2==1.0`.
2. Bake or mount SAM 2 checkpoint at `/opt/sam2/sam2_hiera_small.pt`.
3. Redeploy with `ENABLE_SAM2=true`:

   ```bash
   ENABLE_SAM2=true GCP_PROJECT_ID=stageflip-prod ./scripts/deploy-cv-worker.sh
   ```

4. Smoke-test: hit `POST /detect` with a known fixture and assert the
   response includes the `masks` key.

## Telemetry handoff

OpenTelemetry / Sentry instrumentation is **deferred to T-264** (Phase 12).
Until then, Cloud Run's default metrics + the structured-logging fields
above are the primary signal. Custom dashboards can be wired to the
`run.googleapis.com/request_latencies` and `run.googleapis.com/request_count`
metrics filtered to `service_name="stageflip-cv-worker"`.

## Security notes

- The service is `--no-allow-unauthenticated`. Callers must present a Google
  ID token (set as `Authorization: Bearer <token>` by the TS-side
  `HttpCvProvider`); Cloud Run validates the token before forwarding the
  request.
- The Python container runs as the non-root `app` user (uid/gid auto-assigned
  by `useradd --system`). The image has no SSH, no shell exposed beyond the
  uvicorn process.
- Slide thumbnails are PII-adjacent (a deck may contain proprietary content).
  The service does NOT persist incoming images — they're decoded in-memory
  and discarded after each request. Cloud Run's request log captures URL +
  status + size, never the body.

## Known limitations (v1)

- Single-region deployment (`us-central1`). EU-residency for GDPR is T-271.
- No GPU acceleration. Per-request latency target is 3–5 s; if the p99
  exceeds 10 s sustained, escalate per CLAUDE.md §6.
- No batched inference; each request handles one slide thumbnail.
- SAM 2 is opt-in and not in v1's default rollout.
