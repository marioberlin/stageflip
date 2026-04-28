// tests/load/retry-after.test.ts
// AC #11 — pin retry-after parsing. Critical: must NEVER return 0 / NaN /
// negative — that would translate to a tight loop against the staging tenant.

import { describe, expect, it } from 'vitest';

import {
  MAX_RETRIES,
  MAX_SLEEP_SECONDS,
  MIN_SLEEP_SECONDS,
  computeRetryAfter,
} from './retry-after.js';

describe('computeRetryAfter()', () => {
  it('parses integer-seconds Retry-After header', () => {
    expect(computeRetryAfter({ header: '5' })).toBe(5);
  });

  it('floors at MIN_SLEEP_SECONDS even when header says 0', () => {
    // Critical safety: server says "retry immediately"; we still wait 1 s
    // to prevent a tight loop.
    expect(computeRetryAfter({ header: '0' })).toBe(MIN_SLEEP_SECONDS);
    expect(computeRetryAfter({ header: '   ' })).toBe(MIN_SLEEP_SECONDS);
    expect(computeRetryAfter({})).toBe(MIN_SLEEP_SECONDS);
  });

  it('caps at MAX_SLEEP_SECONDS even for absurd server values', () => {
    expect(computeRetryAfter({ header: '99999' })).toBe(MAX_SLEEP_SECONDS);
  });

  it('falls back to body retryAfterSeconds when header is missing', () => {
    const body = JSON.stringify({ code: 'RATE_LIMITED', tier: 'user', retryAfterSeconds: 3 });
    expect(computeRetryAfter({ body })).toBe(3);
  });

  it('matches T-263 wire shape exactly (rejects unrelated JSON bodies)', () => {
    const body = JSON.stringify({ retryAfterSeconds: 7 }); // missing code
    expect(computeRetryAfter({ body })).toBe(MIN_SLEEP_SECONDS);
  });

  it('survives malformed JSON body', () => {
    expect(computeRetryAfter({ body: 'not json' })).toBe(MIN_SLEEP_SECONDS);
    expect(computeRetryAfter({ body: '' })).toBe(MIN_SLEEP_SECONDS);
    expect(computeRetryAfter({ body: null })).toBe(MIN_SLEEP_SECONDS);
  });

  it('header takes precedence over body', () => {
    const body = JSON.stringify({ code: 'RATE_LIMITED', tier: 'user', retryAfterSeconds: 25 });
    expect(computeRetryAfter({ header: '4', body })).toBe(4);
  });

  it('rejects non-numeric header values gracefully', () => {
    // Falls into HTTP-date branch; for an unparseable date, returns MIN.
    expect(computeRetryAfter({ header: 'forever' })).toBe(MIN_SLEEP_SECONDS);
  });

  it('parses HTTP-date header without crashing', () => {
    // The date branch returns MIN_SLEEP_SECONDS by design (we'd need a "now"
    // reference to compute a real delta, and the next attempt corrects).
    expect(computeRetryAfter({ header: 'Wed, 21 Oct 2026 07:28:00 GMT' })).toBe(MIN_SLEEP_SECONDS);
  });

  it('exports a sane MAX_RETRIES (≤ 5; AC #11 bounds tight-loop risk)', () => {
    expect(MAX_RETRIES).toBeLessThanOrEqual(5);
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(1);
  });

  it('rejects negative retryAfterSeconds in body', () => {
    const body = JSON.stringify({ code: 'RATE_LIMITED', tier: 'user', retryAfterSeconds: -5 });
    // Negative is invalid; falls through to MIN.
    expect(computeRetryAfter({ body })).toBe(MIN_SLEEP_SECONDS);
  });
});
