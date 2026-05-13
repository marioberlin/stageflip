// packages/marketplace-tier/src/policy/tier-policy.test.ts
// T-543 — `DEFAULT_TIER_POLICY` shape + grace-window invariant tests.

import { describe, expect, it } from 'vitest';
import { DEFAULT_TIER_LIMITS } from '../limits/tier-limits.js';
import {
  DEFAULT_TIER_POLICY,
  LAPSED_GRACE_PERIOD_MS,
  TRIAL_GRACE_PERIOD_MS,
} from './tier-policy.js';

describe('DEFAULT_TIER_POLICY', () => {
  it('exposes limits + the two grace fields', () => {
    expect(Object.keys(DEFAULT_TIER_POLICY).sort()).toEqual([
      'lapsedGracePeriodMs',
      'limits',
      'trialGracePeriodMs',
    ]);
  });

  it('limits maps to the DEFAULT_TIER_LIMITS constant', () => {
    expect(DEFAULT_TIER_POLICY.limits).toBe(DEFAULT_TIER_LIMITS);
  });

  it('trial grace period defaults to 7 days (604_800_000 ms)', () => {
    expect(TRIAL_GRACE_PERIOD_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(DEFAULT_TIER_POLICY.trialGracePeriodMs).toBe(TRIAL_GRACE_PERIOD_MS);
  });

  it('lapsed grace period defaults to 3 days (259_200_000 ms)', () => {
    expect(LAPSED_GRACE_PERIOD_MS).toBe(3 * 24 * 60 * 60 * 1000);
    expect(DEFAULT_TIER_POLICY.lapsedGracePeriodMs).toBe(LAPSED_GRACE_PERIOD_MS);
  });

  it('grace periods are positive integers', () => {
    expect(DEFAULT_TIER_POLICY.trialGracePeriodMs).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_TIER_POLICY.trialGracePeriodMs)).toBe(true);
    expect(DEFAULT_TIER_POLICY.lapsedGracePeriodMs).toBeGreaterThan(0);
    expect(Number.isInteger(DEFAULT_TIER_POLICY.lapsedGracePeriodMs)).toBe(true);
  });

  it('lapsed grace is shorter than trial grace (consistent with §D4)', () => {
    expect(DEFAULT_TIER_POLICY.lapsedGracePeriodMs).toBeLessThan(
      DEFAULT_TIER_POLICY.trialGracePeriodMs,
    );
  });
});
