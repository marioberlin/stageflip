// packages/observability/src/config.test.ts
// T-264 ACs #14, #15 — env parsing, defaults, invalid sample-rate throws.

import { describe, expect, it } from 'vitest';
import { resolveConfig } from './config.js';

describe('config defaults (AC #14)', () => {
  it('returns documented defaults when no env vars are set', () => {
    const cfg = resolveConfig({});
    expect(cfg.serviceName).toBeUndefined();
    expect(cfg.environment).toBe('dev');
    expect(cfg.traceSampleRate).toBe(1);
    expect(cfg.sentryDsn).toBeUndefined();
    expect(cfg.otlpEndpoint).toBeUndefined();
    expect(cfg.release).toBeUndefined();
  });

  it('reads NODE_ENV → environment (production → prod)', () => {
    expect(resolveConfig({ NODE_ENV: 'production' }).environment).toBe('prod');
  });

  it('reads NODE_ENV → environment (staging passthrough)', () => {
    expect(resolveConfig({ NODE_ENV: 'staging' }).environment).toBe('staging');
  });

  it('reads NODE_ENV → environment (test maps to dev)', () => {
    expect(resolveConfig({ NODE_ENV: 'test' }).environment).toBe('dev');
  });

  it('default sample rate is 1.0 in dev', () => {
    expect(resolveConfig({ NODE_ENV: 'development' }).traceSampleRate).toBe(1);
  });

  it('default sample rate is 0.1 in staging', () => {
    expect(resolveConfig({ NODE_ENV: 'staging' }).traceSampleRate).toBe(0.1);
  });

  it('default sample rate is 0.01 in prod', () => {
    expect(resolveConfig({ NODE_ENV: 'production' }).traceSampleRate).toBe(0.01);
  });

  it('reads OTEL_EXPORTER_OTLP_ENDPOINT', () => {
    expect(
      resolveConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example/v1/traces' }).otlpEndpoint,
    ).toBe('https://otel.example/v1/traces');
  });

  it('reads SENTRY_DSN', () => {
    expect(resolveConfig({ SENTRY_DSN: 'https://abc@sentry.example/1' }).sentryDsn).toBe(
      'https://abc@sentry.example/1',
    );
  });

  it('reads STAGEFLIP_RELEASE', () => {
    expect(resolveConfig({ STAGEFLIP_RELEASE: 'sha-abcdef0' }).release).toBe('sha-abcdef0');
  });

  it('STAGEFLIP_OTEL_TRACE_SAMPLE_RATE overrides env-default sample rate', () => {
    expect(
      resolveConfig({ NODE_ENV: 'production', STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: '0.5' })
        .traceSampleRate,
    ).toBe(0.5);
  });

  it('treats empty SENTRY_DSN as unset', () => {
    expect(resolveConfig({ SENTRY_DSN: '' }).sentryDsn).toBeUndefined();
  });

  it('treats empty OTEL_EXPORTER_OTLP_ENDPOINT as unset', () => {
    expect(resolveConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: '' }).otlpEndpoint).toBeUndefined();
  });
});

describe('config invalid sample rate (AC #15)', () => {
  it('throws on non-numeric value', () => {
    expect(() => resolveConfig({ STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: 'abc' })).toThrow(
      /STAGEFLIP_OTEL_TRACE_SAMPLE_RATE/,
    );
  });

  it('throws when value is < 0', () => {
    expect(() => resolveConfig({ STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: '-0.1' })).toThrow(
      /between 0 and 1/,
    );
  });

  it('throws when value is > 1', () => {
    expect(() => resolveConfig({ STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: '1.5' })).toThrow(
      /between 0 and 1/,
    );
  });

  it('throws on Infinity', () => {
    expect(() => resolveConfig({ STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: 'Infinity' })).toThrow(
      /STAGEFLIP_OTEL_TRACE_SAMPLE_RATE/,
    );
  });

  it('accepts boundary value 0', () => {
    expect(resolveConfig({ STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: '0' }).traceSampleRate).toBe(0);
  });

  it('accepts boundary value 1', () => {
    expect(resolveConfig({ STAGEFLIP_OTEL_TRACE_SAMPLE_RATE: '1' }).traceSampleRate).toBe(1);
  });
});
