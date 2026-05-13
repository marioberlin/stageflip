// packages/marketplace-tier/src/limits/tier-limits.test.ts
// T-543 — `DEFAULT_TIER_LIMITS` shape + invariant tests.

import { describe, expect, it } from 'vitest';
import { DEFAULT_TIER_LIMITS } from './tier-limits.js';

describe('DEFAULT_TIER_LIMITS', () => {
  it('has all four tier keys (none / free / paid / enterprise)', () => {
    expect(Object.keys(DEFAULT_TIER_LIMITS).sort()).toEqual(['enterprise', 'free', 'none', 'paid']);
  });

  it('none tier has zero-budget for every pack kind', () => {
    expect(DEFAULT_TIER_LIMITS.none.maxOpenPacks).toBe(0);
    expect(DEFAULT_TIER_LIMITS.none.maxPaidPacks).toBe(0);
    expect(DEFAULT_TIER_LIMITS.none.maxEnterprisePacks).toBe(0);
    expect(DEFAULT_TIER_LIMITS.none.allowCustomBranding).toBe(false);
    expect(DEFAULT_TIER_LIMITS.none.allowPrivatePacks).toBe(false);
  });

  it('free tier caps open packs at 10 and blocks paid/enterprise', () => {
    expect(DEFAULT_TIER_LIMITS.free.maxOpenPacks).toBe(10);
    expect(DEFAULT_TIER_LIMITS.free.maxPaidPacks).toBe(0);
    expect(DEFAULT_TIER_LIMITS.free.maxEnterprisePacks).toBe(0);
    expect(DEFAULT_TIER_LIMITS.free.allowCustomBranding).toBe(false);
    expect(DEFAULT_TIER_LIMITS.free.allowPrivatePacks).toBe(false);
  });

  it('paid tier is unlimited for open + paid, blocks enterprise', () => {
    expect(DEFAULT_TIER_LIMITS.paid.maxOpenPacks).toBeNull();
    expect(DEFAULT_TIER_LIMITS.paid.maxPaidPacks).toBeNull();
    expect(DEFAULT_TIER_LIMITS.paid.maxEnterprisePacks).toBe(0);
    expect(DEFAULT_TIER_LIMITS.paid.allowCustomBranding).toBe(false);
    expect(DEFAULT_TIER_LIMITS.paid.allowPrivatePacks).toBe(false);
  });

  it('enterprise tier is unlimited across all pack kinds with branding + private', () => {
    expect(DEFAULT_TIER_LIMITS.enterprise.maxOpenPacks).toBeNull();
    expect(DEFAULT_TIER_LIMITS.enterprise.maxPaidPacks).toBeNull();
    expect(DEFAULT_TIER_LIMITS.enterprise.maxEnterprisePacks).toBeNull();
    expect(DEFAULT_TIER_LIMITS.enterprise.allowCustomBranding).toBe(true);
    expect(DEFAULT_TIER_LIMITS.enterprise.allowPrivatePacks).toBe(true);
  });

  it('every tier exposes the five documented fields', () => {
    for (const tier of ['none', 'free', 'paid', 'enterprise'] as const) {
      const limits = DEFAULT_TIER_LIMITS[tier];
      expect(Object.keys(limits).sort()).toEqual([
        'allowCustomBranding',
        'allowPrivatePacks',
        'maxEnterprisePacks',
        'maxOpenPacks',
        'maxPaidPacks',
      ]);
    }
  });
});
