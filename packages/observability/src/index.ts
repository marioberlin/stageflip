// packages/observability/src/index.ts
// @stageflip/observability — OpenTelemetry tracing + Sentry error reporting +
// pino structured logs (T-264). Source of truth:
// skills/stageflip/concepts/observability/SKILL.md.

export { resolveConfig } from './config.js';
export type { DeploymentEnvironment, ObservabilityConfig } from './config.js';
export {
  SENTRY_CAPTURED_MARKER,
  captureBreadcrumb,
  captureError,
} from './errors.js';
export type { SentryClientLike } from './errors.js';
export { initObservability } from './init.js';
export type { InitOptions, InitResult } from './init.js';
export { createLogger } from './logger.js';
export type { CreateLoggerOptions, Logger } from './logger.js';
export {
  buildSentryCliArgs,
  parseArgs as parseSourcemapUploadArgs,
  run as runSourcemapUpload,
  USAGE as SOURCEMAP_UPLOAD_USAGE,
  validateArgs as validateSourcemapUploadArgs,
} from './sourcemap-upload.js';
export type {
  ParsedArgs as SourcemapUploadParsedArgs,
  RunOptions as SourcemapUploadRunOptions,
} from './sourcemap-upload.js';
export {
  FORCED_TRACE_ATTRIBUTE,
  TRACER_NAME,
  getTraceContext,
  withForcedTrace,
  withTraceContext,
} from './tracer.js';
export type { SerializedTraceContext } from './tracer.js';
