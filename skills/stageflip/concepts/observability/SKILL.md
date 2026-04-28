---
title: Observability
id: skills/stageflip/concepts/observability
tier: concept
status: substantive
last_updated: 2026-04-28
owner_task: T-264
related:
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# Observability

Three signals — traces, errors, logs — emitted from one package.

## What `@stageflip/observability` ships

| Signal | Tool | Public surface |
|---|---|---|
| Traces | OpenTelemetry JS | `initObservability`, `withForcedTrace`, `getTraceContext`, `withTraceContext` |
| Errors | Sentry JS | `captureError`, `captureBreadcrumb` |
| Logs | `pino` | `createLogger(name)` |

One import, one process-start call:

```ts
import { initObservability } from '@stageflip/observability';

initObservability({
  serviceName: 'collab-server',
  serviceVersion: process.env.npm_package_version,
});
```

`initObservability` is **idempotent**. The first call wins; subsequent calls
return the existing singleton. Call it before any module that emits telemetry.

## Sampling (D-T264-2)

| Environment | Trace sample rate | Error sample rate |
|---|---|---|
| dev | 1.0 (everything) | 1.0 |
| staging | 0.1 | 1.0 |
| prod | 0.01 | 1.0 |

Override per-service via env: `STAGEFLIP_OTEL_TRACE_SAMPLE_RATE=0.5`.

### Forced sampling — critical paths

```ts
import { withForcedTrace } from '@stageflip/observability';

await withForcedTrace('payment.charge', async () => {
  // ... runs inside a span that is ALWAYS sampled (1.0), regardless of base rate.
});
```

Use sparingly. Reserved for: authentication flows, payment / billing,
data export jobs, anything where losing visibility is worse than the
extra trace volume.

The forced-flag is enforced by a wrapping sampler (`ForcedAttributeSampler`)
so even when `STAGEFLIP_OTEL_TRACE_SAMPLE_RATE=0`, the forced span exports.

## Standard span attributes (D-T264-4)

Every span SHOULD carry, when available (set by per-package instrumentation):

- `org.id`
- `user.id`
- `service.name` — set by `initObservability` from `serviceName`.
- `service.version` — set by `initObservability` from `serviceVersion`.
- `deployment.environment` — `dev` / `staging` / `prod`.

Per-domain attributes (e.g. `collab.docId`, `render.renderId`,
`export.targetFormat`) are added by each consumer's instrumentation rollout.

## Trace propagation across hops (D-T264-3)

HTTP requests are propagated automatically via the W3C `traceparent` header
(`W3CTraceContextPropagator`).

For non-HTTP service hops — BullMQ jobs, Yjs storage delta calls, RTDB writes
— the producer extracts a serializable context and the consumer restores it:

```ts
// Producer (HTTP handler about to enqueue work)
import { getTraceContext } from '@stageflip/observability';

const traceCtx = getTraceContext();
await renderQueue.add('render-frame', { renderId, traceCtx });

// Consumer (BullMQ worker)
import { withTraceContext } from '@stageflip/observability';

worker.process(async (job) => {
  await withTraceContext(job.data.traceCtx, async () => {
    // spans created here are children of the upstream HTTP span.
  });
});
```

The downstream span's parent-span-id matches the upstream span-id, so traces
join end-to-end.

## Error reporting

```ts
import { captureError, captureBreadcrumb } from '@stageflip/observability';

captureBreadcrumb('user.click', { button: 'export' });
try {
  await doWork();
} catch (err) {
  captureError(err, { renderId, orgId });
  throw err;
}
```

`captureError` accepts `Error.cause` chains (Sentry walks `.cause`
automatically); attaches the optional context as `extra`.

### Off-Sentry mode

When `SENTRY_DSN` is unset, every error API is a silent no-op. OTel still
initializes. Useful for staging environments and local development without
a real Sentry project.

### OTel + Sentry HTTP coexistence

Sentry's auto-instrumentation also creates spans for HTTP requests by default.
T-264 disables Sentry's default integrations + sets `tracesSampleRate: 0` so
**OTel owns HTTP spans** and Sentry owns errors only. Avoids double-counting.

## Structured logs (D-T264-6)

```ts
import { createLogger } from '@stageflip/observability';

const log = createLogger('collab-server');
log.info({ docId }, 'document loaded');
log.error(err);  // ← auto-promoted to Sentry.captureException
```

The logger is `pino`. Two augmentations:

1. **Trace correlation**: when called inside an active OTel span, every log
   line carries `traceparent` + `span_id` fields.
2. **Sentry promotion**: `log.error(err)` where `err instanceof Error` calls
   `captureError(err)` automatically — unless the error has already been
   captured (the marker on the error instance prevents double-capture).

## Release tracking + sourcemaps (D-T264-5)

`STAGEFLIP_RELEASE` (set from CI) is plumbed through to Sentry as the
`release` field. Sourcemaps for that release are uploaded by:

```bash
tsx scripts/sentry-upload-sourcemaps.ts \
  --release=$STAGEFLIP_RELEASE \
  --org=$SENTRY_ORG \
  --project=$SENTRY_PROJECT \
  --path=packages/collab/dist
```

CI runs this after `pnpm build`. `--dry-run` prints the planned command
without invoking sentry-cli — useful for PRs that touch the script.

## Determinism posture (D-T264-7)

`packages/observability/**` is NOT in the determinism scan
(`scripts/check-determinism.ts` `DETERMINISTIC_GLOBS`). Telemetry is
wall-clock + network-driven by nature; the CI gate exempts it.

Per-package consumers must not let observability code leak into clip /
runtime files. If you need a span around frame logic, instrument the
*caller*, not the deterministic core.

## Per-package instrumentation rollout

T-264 ships the SDK. Per-package follow-ups wire spans around hot paths
in:

- `@stageflip/collab` — Yjs document open / sync / close.
- `@stageflip/storage*` — Firestore / Postgres reads + writes.
- `@stageflip/renderer-cdp` — frame render lifecycle.
- `@stageflip/cv-worker` — bridge over `@stageflip/cv-worker` requests.
- `@stageflip/engine` — agent tool calls (one span per tool invocation).

Each rollout adds the standard span attributes plus its domain-specific keys.

## Load testing (T-269)

Load tests live in `tests/load/` (workspace package `@stageflip/tests-load`).
Three K6 scenarios cover the load-bearing surfaces:

| Scenario | Surface | What it asserts |
|---|---|---|
| `collab-sync.js` | Yjs delta fan-out (WebSocket) | P95 round-trip < 200 ms (full) / < 300 ms (smoke) |
| `render-submit.js` | BullMQ queue ingress | P95 accept < 100 ms (full) / < 150 ms (smoke); err < 0.5 % |
| `api-mixed.js` | Public API mix | no 5xx; respects 429 + Retry-After (T-263 wire shape) |

Two profiles share the scenarios:

- **Smoke** — CI on every change to `tests/load/**`. 10 VUs x 60 s each.
  Workflow: `.github/workflows/load-smoke.yml`. Runs `k6 archive` always
  (syntax + import gate); runs the live scenarios when `vars.STAGING_LOAD_URL`
  is configured.
- **Full** — operational; `pnpm load:full` against a staging tenant.
  50 VUs x 5 min each. Output JSON summaries under `tests/load/runs/`.

The K6 helpers (`tests/load/helpers.js`) wrap every HTTP request in the
T-263 retry-after handler (`computeRetryAfter`), bounded at 3 retries with
1-30 s per sleep so the load test cannot tight-loop the staging tenant on
429. Auth headers follow T-262 conventions (`Authorization: Bearer ...` +
`X-Org-Id`).

`tests/load/**` is exempt from `pnpm check-determinism` (D-T269-5) — load
scenarios use `Math.random()` for action selection by design.

Output location: `tests/load/runs/*.json` (gitignored). CI uploads them as
a `load-smoke-summaries-<sha>` artifact for 7 days.

## Backup + restore (T-272)

The backup + verification Cloud Functions in
`firebase/functions/src/backup/` consume `@stageflip/observability` for
both error reporting (`captureError`) and structured logs (`createLogger`).
The verifier asserts existence + size > 0 + JSON-parse on each expected
backup file; failures emit Sentry alerts via `captureError` AND log at
error level (which auto-promotes per the logger semantics above).

Operational runbook: `docs/ops/restore-procedure.md`. Architecture:
`docs/ops/backup-architecture.md`. Drill log:
`docs/ops/restore-drill-2026-04.md`.
