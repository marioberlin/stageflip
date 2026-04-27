// packages/rate-limit/src/errors.test.ts
// T-263 ACs #15, #16 — RateLimitedError fields + toJSON wire shape.

import { describe, expect, it } from 'vitest';
import { RateLimitedError } from './errors.js';

describe('RateLimitedError (AC #15)', () => {
  it('extends Error with tier + retryAfterMs', () => {
    const err = new RateLimitedError({ tier: 'user', retryAfterMs: 1234 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RateLimitedError');
    expect(err.tier).toBe('user');
    expect(err.retryAfterMs).toBe(1234);
    expect(err.message).toMatch(/tier=user/);
    expect(err.message).toMatch(/1234ms/);
  });
});

describe('RateLimitedError.toJSON wire shape (AC #16)', () => {
  it('serialises as { code, tier, retryAfterSeconds }', () => {
    const err = new RateLimitedError({ tier: 'org', retryAfterMs: 1500 });
    expect(err.toJSON()).toEqual({
      code: 'RATE_LIMITED',
      tier: 'org',
      retryAfterSeconds: 2, // ceil(1500/1000)
    });
  });

  it('rounds up sub-second retries to 1', () => {
    const err = new RateLimitedError({ tier: 'apiKey', retryAfterMs: 250 });
    expect(err.toJSON().retryAfterSeconds).toBe(1);
  });

  it('rounds 0ms retry to 0 seconds', () => {
    const err = new RateLimitedError({ tier: 'user', retryAfterMs: 0 });
    expect(err.toJSON().retryAfterSeconds).toBe(0);
  });

  it('preserves exact-second values', () => {
    const err = new RateLimitedError({ tier: 'user', retryAfterMs: 5000 });
    expect(err.toJSON().retryAfterSeconds).toBe(5);
  });
});
