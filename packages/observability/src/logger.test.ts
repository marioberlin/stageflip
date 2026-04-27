// packages/observability/src/logger.test.ts
// T-264 ACs #11, #12, #13 — JSON output, trace correlation, error → Sentry promotion.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetErrorsForTests, __setSentryClientForTests } from './errors.js';
import { createLogger } from './logger.js';
import { __resetTracerForTests, __setupTestTracer, withForcedTrace } from './tracer.js';

interface CapturedLine {
  name?: string;
  msg?: string;
  level?: number | string;
  traceparent?: string;
  span_id?: string;
  [k: string]: unknown;
}

function makeStream(lines: CapturedLine[]): NodeJS.WritableStream {
  return {
    write(chunk: string | Uint8Array): boolean {
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      // pino writes one JSON object per line.
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        lines.push(JSON.parse(line) as CapturedLine);
      }
      return true;
    },
  } as unknown as NodeJS.WritableStream;
}

describe('logger basic JSON output (AC #11)', () => {
  it('emits a JSON line with name, msg, level=info, and merged props', () => {
    const lines: CapturedLine[] = [];
    const log = createLogger('my-service', { stream: makeStream(lines) });
    log.info({ foo: 'bar' }, 'hello');

    expect(lines.length).toBe(1);
    const [line] = lines;
    expect(line?.name).toBe('my-service');
    expect(line?.msg).toBe('hello');
    expect(line?.foo).toBe('bar');
    // pino emits level as numeric by default (info = 30); accept either form.
    expect(['info', 30]).toContain(line?.level as number | string);
  });
});

describe('logger trace correlation (AC #12)', () => {
  beforeEach(() => {
    __setupTestTracer({ sampleRate: 1 });
  });

  afterEach(() => {
    __resetTracerForTests();
  });

  it('inside an active span, log line carries traceparent + span_id', async () => {
    const lines: CapturedLine[] = [];
    const log = createLogger('svc', { stream: makeStream(lines) });
    await withForcedTrace('span-under-test', async () => {
      log.info('within-span');
    });

    expect(lines.length).toBe(1);
    const [line] = lines;
    expect(line?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
    expect(line?.span_id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('outside any span, log line omits traceparent and span_id', () => {
    const lines: CapturedLine[] = [];
    const log = createLogger('svc', { stream: makeStream(lines) });
    log.info('no-span');
    expect(lines[0]?.traceparent).toBeUndefined();
    expect(lines[0]?.span_id).toBeUndefined();
  });
});

describe('logger error → Sentry promotion (AC #13)', () => {
  beforeEach(() => {
    __resetErrorsForTests();
  });

  afterEach(() => {
    __resetErrorsForTests();
  });

  it('logger.error(err) auto-calls Sentry.captureException', () => {
    const fake = { captureException: vi.fn(), addBreadcrumb: vi.fn() };
    __setSentryClientForTests(fake);

    const lines: CapturedLine[] = [];
    const log = createLogger('svc', { stream: makeStream(lines) });
    const err = new Error('promote-me');
    log.error(err);

    expect(fake.captureException).toHaveBeenCalledTimes(1);
    expect(fake.captureException).toHaveBeenCalledWith(err, expect.any(Object));
  });

  it('does NOT double-capture when caller has already called captureError', () => {
    // The contract: logger promotion adds a marker; if the marker says
    // already-captured, it skips. This protects the orchestrator-flagged risk
    // of double-counting (spec Note #2).
    const fake = { captureException: vi.fn(), addBreadcrumb: vi.fn() };
    __setSentryClientForTests(fake);

    const lines: CapturedLine[] = [];
    const log = createLogger('svc', { stream: makeStream(lines) });

    const err = new Error('once');
    // Manually mark as already captured (mimics direct captureError call).
    (err as Error & { __stageflipSentryCaptured?: boolean }).__stageflipSentryCaptured = true;

    log.error(err);
    expect(fake.captureException).not.toHaveBeenCalled();
  });

  it('logger.error with non-Error value still emits log but does not call Sentry', () => {
    const fake = { captureException: vi.fn(), addBreadcrumb: vi.fn() };
    __setSentryClientForTests(fake);

    const lines: CapturedLine[] = [];
    const log = createLogger('svc', { stream: makeStream(lines) });
    log.error('plain-string-message');

    expect(fake.captureException).not.toHaveBeenCalled();
    expect(lines.length).toBe(1);
  });

  it('off-Sentry mode → logger.error(err) is silent (no throw)', () => {
    __setSentryClientForTests(null);
    const lines: CapturedLine[] = [];
    const log = createLogger('svc', { stream: makeStream(lines) });
    expect(() => log.error(new Error('quiet'))).not.toThrow();
  });
});
