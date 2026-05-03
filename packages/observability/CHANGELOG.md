# @stageflip/observability

## 0.1.0

### Minor Changes

- b07cff4: T-264 — initial release. OpenTelemetry tracing + Sentry error reporting +
  pino structured logs in a single package; one import, one process-start
  call (`initObservability`). W3C `traceparent` propagation across HTTP
  hops; `getTraceContext` / `withTraceContext` helpers for BullMQ + event
  propagation. `withForcedTrace` opts critical paths into 100% sampling
  regardless of base rate. `createLogger` enriches every line with
  `traceparent` + `span_id` when inside an active span and auto-promotes
  `logger.error(err)` to Sentry without double-capture. Off-Sentry mode
  when `SENTRY_DSN` is unset. Sourcemap upload helper at
  `scripts/sentry-upload-sourcemaps.ts`. Per-package instrumentation
  rollouts are follow-ups; T-264 ships the SDK + idiom only. See
  `skills/stageflip/concepts/observability/SKILL.md`.
