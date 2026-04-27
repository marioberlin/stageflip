// packages/observability/src/errors.test.ts
// T-264 ACs #8, #9, #10 — captureError forwards to Sentry with cause chain;
// off-Sentry mode is a silent no-op; captureBreadcrumb adds a breadcrumb.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetErrorsForTests,
  __setSentryClientForTests,
  captureBreadcrumb,
  captureError,
} from './errors.js';

interface FakeSentry {
  captureException: ReturnType<typeof vi.fn>;
  addBreadcrumb: ReturnType<typeof vi.fn>;
}

function makeFakeSentry(): FakeSentry {
  return {
    captureException: vi.fn(),
    addBreadcrumb: vi.fn(),
  };
}

describe('captureError', () => {
  let fake: FakeSentry;

  beforeEach(() => {
    fake = makeFakeSentry();
    __setSentryClientForTests(fake);
  });

  afterEach(() => {
    __resetErrorsForTests();
  });

  it('AC #8: forwards a thrown Error to Sentry.captureException', () => {
    const err = new Error('boom');
    captureError(err);
    expect(fake.captureException).toHaveBeenCalledTimes(1);
    expect(fake.captureException).toHaveBeenCalledWith(err, expect.any(Object));
  });

  it('AC #8: preserves cause chain (Sentry Node groks Error.cause natively)', () => {
    const root = new Error('root cause');
    const wrapped = new Error('wrapped', { cause: root });
    captureError(wrapped);
    const [errArg] = fake.captureException.mock.calls[0] ?? [];
    expect(errArg).toBe(wrapped);
    // cause must still be reachable on the captured error (Sentry walks .cause).
    expect((errArg as Error).cause).toBe(root);
  });

  it('AC #8: forwards optional context as Sentry hint extras', () => {
    captureError(new Error('ctx'), { tenantId: 'org_123', requestId: 'req_abc' });
    const [, hint] = fake.captureException.mock.calls[0] ?? [];
    expect(hint).toMatchObject({ extra: { tenantId: 'org_123', requestId: 'req_abc' } });
  });

  it('AC #9: off-Sentry mode (no client) → no-op without throwing', () => {
    __setSentryClientForTests(null);
    expect(() => captureError(new Error('quiet'))).not.toThrow();
  });
});

describe('captureBreadcrumb', () => {
  let fake: FakeSentry;

  beforeEach(() => {
    fake = makeFakeSentry();
    __setSentryClientForTests(fake);
  });

  afterEach(() => {
    __resetErrorsForTests();
  });

  it('AC #10: adds a breadcrumb to current Sentry scope', () => {
    captureBreadcrumb('user.click', { button: 'export' });
    expect(fake.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(fake.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'user.click', data: { button: 'export' } }),
    );
  });

  it('AC #10: works without data argument', () => {
    captureBreadcrumb('plain');
    expect(fake.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({ message: 'plain' }));
  });

  it('AC #9: off-Sentry mode → captureBreadcrumb is a no-op', () => {
    __setSentryClientForTests(null);
    expect(() => captureBreadcrumb('quiet')).not.toThrow();
  });
});
