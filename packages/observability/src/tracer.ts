// packages/observability/src/tracer.ts
// Tracing helpers per D-T264-3 + ACs #5–#7.
//
//   - withForcedTrace(name, fn): runs `fn` inside a span that is ALWAYS sampled
//     regardless of the configured base rate. Implementation: we tag the
//     attributes with a sentinel; the active sampler honours it (see init.ts
//     for the production sampler; __setupTestTracer here installs the same
//     contract for unit tests).
//
//   - getTraceContext(): returns a serializable {traceparent, tracestate?}
//     extracted from the active OTel context via the W3C propagator.
//
//   - withTraceContext(ctx, fn): inverse — restores the upstream context so
//     spans created inside `fn` are children of the upstream span (verifiable
//     via traceparent parent-id match).

import {
  type Context,
  type Span,
  type SpanKind,
  context as otelContext,
  propagation,
  trace,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  InMemorySpanExporter,
  type ReadableSpan,
  type Sampler,
  SamplingDecision,
  type SamplingResult,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

/** Span attribute key used to mark forced spans (see D-T264-2). */
export const FORCED_TRACE_ATTRIBUTE = 'stageflip.observability.forced';

/** Tracer name; consumers can scope further via createLogger / spans. */
export const TRACER_NAME = '@stageflip/observability';

/**
 * Sampler that defers to a wrapped delegate, except when the span carries the
 * `FORCED_TRACE_ATTRIBUTE=true` attribute — in which case the span is always
 * recorded and sampled. AC #5.
 */
export class ForcedAttributeSampler implements Sampler {
  constructor(private readonly delegate: Sampler) {}

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Record<string, unknown>,
    links: unknown[],
  ): SamplingResult {
    if (attributes[FORCED_TRACE_ATTRIBUTE] === true) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }
    // The OTel API types differ slightly across versions; cast to the
    // delegate's signature. Both AlwaysOn / TraceIdRatioBased accept this.
    return this.delegate.shouldSample(
      context,
      traceId,
      spanName,
      spanKind,
      attributes as never,
      links as never,
    );
  }

  toString(): string {
    return `ForcedAttribute{${this.delegate.toString()}}`;
  }
}

const propagator = new W3CTraceContextPropagator();

/** Module-level provider (set by initObservability or __setupTestTracer). */
let activeProvider: NodeTracerProvider | null = null;
let inMemoryExporter: InMemorySpanExporter | null = null;

/** Internal — used by init.ts to register the production provider. */
export function __registerProvider(provider: NodeTracerProvider): void {
  activeProvider = provider;
}

/** Test helper: install an in-memory tracer with the configured sampler. */
export function __setupTestTracer(opts: { sampleRate: number }): void {
  __resetTracerForTests();
  const base: Sampler = opts.sampleRate >= 1 ? new AlwaysOnSampler() : new AlwaysOffSampler();
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'test' }),
    sampler: new ForcedAttributeSampler(base),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  provider.register({ propagator });
  activeProvider = provider;
  inMemoryExporter = exporter;
}

/** Test helper — flush + return the spans recorded so far. */
export function __getInMemorySpansForTests(): readonly ReadableSpan[] {
  return inMemoryExporter?.getFinishedSpans() ?? [];
}

/** Test helper — tear down the tracer + propagator state. */
export function __resetTracerForTests(): void {
  if (activeProvider !== null) {
    void activeProvider.shutdown();
    activeProvider = null;
  }
  inMemoryExporter = null;
  trace.disable();
  propagation.disable();
  otelContext.disable();
}

/** Get the active tracer (or the no-op tracer if uninitialized). */
function tracer() {
  return trace.getTracer(TRACER_NAME);
}

/**
 * Run `fn` inside a span that is ALWAYS sampled regardless of the configured
 * base sample rate. Use sparingly — auth, payment, export, etc. (D-T264-2).
 *
 * AC #5.
 */
export async function withForcedTrace<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
): Promise<T> {
  const span = tracer().startSpan(name, {
    attributes: { [FORCED_TRACE_ATTRIBUTE]: true },
  });
  try {
    return await otelContext.with(trace.setSpan(otelContext.active(), span), () => fn(span));
  } catch (err) {
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Serializable trace context — suitable for embedding in a BullMQ job payload
 * or an event header so a downstream worker can resume the trace via
 * `withTraceContext`. AC #6.
 */
export interface SerializedTraceContext {
  /** W3C traceparent header value; absent when no active span. */
  readonly traceparent?: string;
  /** Optional W3C tracestate header value. */
  readonly tracestate?: string;
}

/** Extract the W3C traceparent / tracestate from the active OTel context. */
export function getTraceContext(): SerializedTraceContext {
  const carrier: Record<string, string> = {};
  propagator.inject(otelContext.active(), carrier, {
    set: (c, k, v) => {
      (c as Record<string, string>)[k] = String(v);
    },
  });
  const out: { traceparent?: string; tracestate?: string } = {};
  if (carrier.traceparent) out.traceparent = carrier.traceparent;
  if (carrier.tracestate) out.tracestate = carrier.tracestate;
  return out;
}

/**
 * Restore an upstream trace context, then run `fn`. Spans created inside `fn`
 * are children of the upstream span (verifiable via traceparent parent-id
 * match). AC #7.
 */
export async function withTraceContext<T>(
  ctx: SerializedTraceContext,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (!ctx.traceparent) return fn();
  const carrier: Record<string, string> = { traceparent: ctx.traceparent };
  if (ctx.tracestate) carrier.tracestate = ctx.tracestate;
  const restored = propagator.extract(otelContext.active(), carrier, {
    get: (c, k) => (c as Record<string, string>)[k],
    keys: (c) => Object.keys(c as Record<string, string>),
  });
  return otelContext.with(restored, fn);
}
