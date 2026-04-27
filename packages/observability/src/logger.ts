// packages/observability/src/logger.ts
// pino-backed structured logger with two augmentations per D-T264-6:
//   1. Each log line is enriched with `traceparent` and `span_id` when emitted
//      inside an active OTel span. (AC #12)
//   2. `logger.error(err)` auto-promotes to Sentry via captureError unless the
//      error already carries the SENTRY_CAPTURED_MARKER (AC #13, no-double-capture).

import { context as otelContext, trace } from '@opentelemetry/api';
import pino, { type Logger as PinoLogger } from 'pino';

import { SENTRY_CAPTURED_MARKER, captureError } from './errors.js';
import { getTraceContext } from './tracer.js';

/** Options accepted by createLogger. */
export interface CreateLoggerOptions {
  /** Override pino's destination — used by tests. */
  readonly stream?: NodeJS.WritableStream;
  /** Override level. Default: 'info'. */
  readonly level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

/** Public logger surface — a pino logger with a known shape. */
export type Logger = PinoLogger;

/** Build a `mixin` that injects traceparent + span_id when inside a span. */
function traceMixin(): Record<string, unknown> {
  const span = trace.getSpan(otelContext.active());
  if (!span) return {};
  const ctx = getTraceContext();
  const out: Record<string, unknown> = {};
  if (ctx.traceparent) out.traceparent = ctx.traceparent;
  const spanCtx = span.spanContext();
  if (spanCtx.spanId) out.span_id = spanCtx.spanId;
  return out;
}

/**
 * Create a logger named for the calling service. Output is JSON; enriched
 * with trace context when inside an active span (AC #12); error promotion
 * to Sentry on `.error(err)` calls (AC #13).
 */
export function createLogger(name: string, options: CreateLoggerOptions = {}): Logger {
  const opts: pino.LoggerOptions = {
    name,
    level: options.level ?? 'info',
    mixin: traceMixin,
  };

  const base: PinoLogger = options.stream ? pino(opts, options.stream) : pino(opts);

  // Wrap .error to auto-promote Errors to Sentry. We patch in place because
  // pino's child() chain preserves overridden methods on the parent prototype
  // via __proto__ — so we patch the instance.
  const originalError = base.error.bind(base);
  base.error = ((...args: unknown[]) => {
    const first = args[0];
    if (first instanceof Error) {
      const marked = (first as unknown as Record<string, unknown>)[SENTRY_CAPTURED_MARKER] === true;
      if (!marked) {
        captureError(first);
      }
    }
    // Forward to pino's native .error with the original variadic shape.
    // pino accepts (msg) | (obj, msg) | (err) | (err, msg) — we don't reshape.
    return (originalError as (...a: unknown[]) => void)(...args);
  }) as PinoLogger['error'];

  return base;
}
