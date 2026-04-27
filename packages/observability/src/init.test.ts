// packages/observability/src/init.test.ts
// T-264 ACs #1–#4 — initObservability registers SDKs, idempotent, off-Sentry,
// console-fallback exporter when no OTLP endpoint.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetForTests, initObservability } from './init.js';

describe('initObservability', () => {
  beforeEach(() => {
    __resetForTests();
    vi.resetModules();
  });

  afterEach(() => {
    __resetForTests();
  });

  it('AC #1: registers and reports initialized=true on first call', () => {
    const result = initObservability({
      serviceName: 'test-svc',
      environment: 'dev',
      traceSampleRate: 1,
    });
    expect(result.initialized).toBe(true);
    expect(result.otelEnabled).toBe(true);
  });

  it('AC #2: idempotent — second call is no-op and returns the same singleton', () => {
    const a = initObservability({ serviceName: 'test-svc', environment: 'dev' });
    const b = initObservability({ serviceName: 'other-svc', environment: 'prod' });
    expect(a).toBe(b);
    expect(b.serviceName).toBe('test-svc');
  });

  it('AC #3: SENTRY_DSN unset → Sentry init skipped silently, OTel still init', () => {
    const result = initObservability({
      serviceName: 'no-sentry',
      environment: 'dev',
      traceSampleRate: 1,
    });
    expect(result.sentryEnabled).toBe(false);
    expect(result.otelEnabled).toBe(true);
  });

  it('AC #3: empty-string SENTRY_DSN → Sentry init skipped', () => {
    const result = initObservability({
      serviceName: 'empty-dsn',
      environment: 'dev',
      sentryDsn: '',
    });
    expect(result.sentryEnabled).toBe(false);
  });

  it('AC #3: provided SENTRY_DSN → Sentry init succeeds (offline DSN, no network)', () => {
    const result = initObservability({
      serviceName: 'with-sentry',
      environment: 'dev',
      sentryDsn: 'https://abc@sentry.local/1',
    });
    expect(result.sentryEnabled).toBe(true);
  });

  it('AC #4: no OTLP endpoint → console exporter fallback', () => {
    const result = initObservability({
      serviceName: 'console-fallback',
      environment: 'dev',
    });
    expect(result.exporter).toBe('console');
  });

  it('AC #4: with OTLP endpoint → otlp exporter selected', () => {
    const result = initObservability({
      serviceName: 'otlp',
      environment: 'dev',
      otlpEndpoint: 'https://otel.local/v1/traces',
    });
    expect(result.exporter).toBe('otlp');
  });
});
