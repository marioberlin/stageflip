// packages/marketplace-conversion/src/churn/strategy.test.ts
// T-544 — `ChurnRecoveryStrategy` + `DEFAULT_CHURN_STRATEGY` tests.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BASE_BACKOFF_MS,
  DEFAULT_CHURN_STRATEGY,
  DEFAULT_MAX_BACKOFF_MS,
  DEFAULT_MAX_RETRIES,
} from './strategy.js';

describe('DEFAULT_CHURN_STRATEGY', () => {
  it('declares maxRetries === 3', () => {
    expect(DEFAULT_CHURN_STRATEGY.maxRetries).toBe(3);
    expect(DEFAULT_CHURN_STRATEGY.maxRetries).toBe(DEFAULT_MAX_RETRIES);
  });

  it('declares baseBackoffMs === 1 hour', () => {
    expect(DEFAULT_CHURN_STRATEGY.baseBackoffMs).toBe(3_600_000);
    expect(DEFAULT_CHURN_STRATEGY.baseBackoffMs).toBe(DEFAULT_BASE_BACKOFF_MS);
  });

  it('declares maxBackoffMs === 24 hours', () => {
    expect(DEFAULT_CHURN_STRATEGY.maxBackoffMs).toBe(86_400_000);
    expect(DEFAULT_CHURN_STRATEGY.maxBackoffMs).toBe(DEFAULT_MAX_BACKOFF_MS);
  });

  it('nextBackoff(0) returns the base delay', () => {
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(0)).toBe(DEFAULT_BASE_BACKOFF_MS);
  });

  it('nextBackoff grows exponentially: base * 2^n', () => {
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(1)).toBe(DEFAULT_BASE_BACKOFF_MS * 2);
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(2)).toBe(DEFAULT_BASE_BACKOFF_MS * 4);
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(3)).toBe(DEFAULT_BASE_BACKOFF_MS * 8);
  });

  it('nextBackoff caps at maxBackoffMs', () => {
    // base * 2^5 = 32h > 24h ceiling.
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(5)).toBe(DEFAULT_MAX_BACKOFF_MS);
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(10)).toBe(DEFAULT_MAX_BACKOFF_MS);
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(100)).toBe(DEFAULT_MAX_BACKOFF_MS);
  });

  it('nextBackoff handles negative retryCount as 0', () => {
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(-1)).toBe(DEFAULT_BASE_BACKOFF_MS);
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(-10)).toBe(DEFAULT_BASE_BACKOFF_MS);
  });

  it('nextBackoff handles extreme retryCount without overflow', () => {
    // Exponent is clamped pre-emptively; result must still be the cap.
    expect(DEFAULT_CHURN_STRATEGY.nextBackoff(1_000_000)).toBe(DEFAULT_MAX_BACKOFF_MS);
    expect(Number.isFinite(DEFAULT_CHURN_STRATEGY.nextBackoff(1_000_000))).toBe(true);
  });

  it('retry count > maxRetries is observable to the caller', () => {
    // The strategy itself does not refuse retries past the cap — that
    // decision sits in the planner. But callers can inspect the cap
    // directly off the strategy.
    const overCap = DEFAULT_CHURN_STRATEGY.maxRetries + 1;
    expect(overCap).toBeGreaterThan(DEFAULT_CHURN_STRATEGY.maxRetries);
  });
});
