// packages/observability/src/init.ts
// initObservability — single entry point per D-T264-1. Idempotent module
// singleton (AC #2). Wires OTel tracer provider + Sentry SDK based on env
// (D-T264-2, AC #3, AC #4). Per spec note #6, OTel handles HTTP
// instrumentation; we DO NOT enable Sentry's auto-instrumentation tracer to
// avoid double-emit of HTTP spans.

import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  type Sampler,
  SimpleSpanProcessor,
  type SpanExporter,
  type SpanProcessor,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import * as Sentry from '@sentry/node';

import { type DeploymentEnvironment, resolveConfig } from './config.js';
import { __setSentryClientForTests } from './errors.js';
import { ForcedAttributeSampler, __registerProvider } from './tracer.js';

/** Public init options. Env-resolved values are used as fallbacks. */
export interface InitOptions {
  /** Service identifier — set OTel `service.name` resource attribute. */
  readonly serviceName: string;
  /** Deployment environment — overrides NODE_ENV mapping. */
  readonly environment?: DeploymentEnvironment;
  /** Trace sample rate ∈ [0, 1]. Forced spans bypass this regardless. */
  readonly traceSampleRate?: number;
  /** Sentry DSN; empty/undefined disables Sentry (AC #3). */
  readonly sentryDsn?: string;
  /** OTLP HTTP endpoint; empty/undefined falls back to console exporter (AC #4). */
  readonly otlpEndpoint?: string;
  /** Release identifier (git SHA). */
  readonly release?: string;
  /** Service version (typically `package.json` version). */
  readonly serviceVersion?: string;
}

/** What initObservability returns. The same singleton is returned on subsequent calls. */
export interface InitResult {
  readonly initialized: true;
  readonly serviceName: string;
  readonly environment: DeploymentEnvironment;
  readonly traceSampleRate: number;
  readonly otelEnabled: boolean;
  readonly sentryEnabled: boolean;
  /** Which OTel exporter is wired ('otlp' | 'console'). AC #4. */
  readonly exporter: 'otlp' | 'console';
}

/** Module-level singleton. Tests reset via __resetForTests. */
let singleton: InitResult | null = null;
let activeProvider: NodeTracerProvider | null = null;

function buildSampler(rate: number): Sampler {
  let base: Sampler;
  if (rate >= 1) base = new AlwaysOnSampler();
  else if (rate <= 0) base = new AlwaysOffSampler();
  else base = new TraceIdRatioBasedSampler(rate);
  return new ForcedAttributeSampler(base);
}

function buildExporter(otlpEndpoint: string | undefined): {
  exporter: SpanExporter;
  kind: 'otlp' | 'console';
} {
  if (otlpEndpoint && otlpEndpoint.length > 0) {
    return { exporter: new OTLPTraceExporter({ url: otlpEndpoint }), kind: 'otlp' };
  }
  return { exporter: new ConsoleSpanExporter(), kind: 'console' };
}

/**
 * Initialize OpenTelemetry tracing + Sentry error reporting. Idempotent —
 * subsequent calls return the original singleton without re-registering. Call
 * once at process start, BEFORE any other module that might emit telemetry.
 */
export function initObservability(opts: InitOptions): InitResult {
  if (singleton !== null) return singleton;

  const envCfg = resolveConfig();
  const environment = opts.environment ?? envCfg.environment;
  const traceSampleRate = opts.traceSampleRate ?? envCfg.traceSampleRate;
  const sentryDsn = opts.sentryDsn ?? envCfg.sentryDsn;
  const otlpEndpoint = opts.otlpEndpoint ?? envCfg.otlpEndpoint;
  const release = opts.release ?? envCfg.release;

  // --- OpenTelemetry ---
  const resource = resourceFromAttributes({
    'service.name': opts.serviceName,
    'service.version': opts.serviceVersion ?? '0.0.0',
    'deployment.environment': environment,
  });
  const sampler = buildSampler(traceSampleRate);
  const { exporter, kind: exporterKind } = buildExporter(otlpEndpoint);
  // Console exporter is fine to flush synchronously; OTLP batches.
  const processor: SpanProcessor =
    exporterKind === 'otlp' ? new BatchSpanProcessor(exporter) : new SimpleSpanProcessor(exporter);

  const provider = new NodeTracerProvider({
    resource,
    sampler,
    spanProcessors: [processor],
  });
  provider.register({ propagator: new W3CTraceContextPropagator() });
  // Belt-and-suspenders: force the global propagator (some ESM consumers
  // import @opentelemetry/api separately).
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  __registerProvider(provider);
  activeProvider = provider;

  // --- Sentry ---
  let sentryEnabled = false;
  if (sentryDsn !== undefined && sentryDsn.length > 0) {
    Sentry.init({
      dsn: sentryDsn,
      environment,
      ...(release !== undefined ? { release } : {}),
      // Per spec note #6: OTel owns HTTP-span emission. Disable Sentry's
      // own performance tracing so we don't double-count HTTP spans.
      tracesSampleRate: 0,
      // Disable default integrations that auto-instrument HTTP.
      defaultIntegrations: false,
    });
    __setSentryClientForTests({
      captureException: (e, h) => Sentry.captureException(e, h as never),
      addBreadcrumb: (b) => Sentry.addBreadcrumb(b),
    });
    sentryEnabled = true;
  } else {
    __setSentryClientForTests(null);
  }

  singleton = {
    initialized: true,
    serviceName: opts.serviceName,
    environment,
    traceSampleRate,
    otelEnabled: true,
    sentryEnabled,
    exporter: exporterKind,
  };
  return singleton;
}

/** Test-only: reset the singleton + tear down the provider. */
export function __resetForTests(): void {
  if (activeProvider !== null) {
    void activeProvider.shutdown();
    activeProvider = null;
  }
  singleton = null;
  __setSentryClientForTests(null);
}
