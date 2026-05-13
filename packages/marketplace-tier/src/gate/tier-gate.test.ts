// packages/marketplace-tier/src/gate/tier-gate.test.ts
// T-543 — `tierGate` unit tests. Cover the (ok, tier, reason) result
// space across the four tiers + the failure paths
// (no-entitlement / lapsed / revoked / pending / trial-expired /
// limit-exceeded).

import { describe, expect, it } from 'vitest';
import { DEFAULT_TIER_POLICY } from '../policy/tier-policy.js';
import type { TenantTierInput } from '../resolver/tier-resolver.js';
import { tierGate } from './tier-gate.js';

function tenantWith(
  sku: string,
  status: 'active' | 'lapsed' | 'revoked' | 'pending' | 'trial',
  extras: { readonly contractRef?: string } = {},
): TenantTierInput {
  return {
    entitlements: new Map([
      [
        sku,
        {
          sku,
          status,
          entitlementType: 'subscription' as const,
          ...(extras.contractRef !== undefined ? { contractRef: extras.contractRef } : {}),
        },
      ],
    ]),
  };
}

const EMPTY_TENANT: TenantTierInput = { entitlements: new Map() };

describe('tierGate — ok cases', () => {
  it('admits open pack on free tier (no entitlement)', () => {
    const result = tierGate({
      pack: { kind: 'open' },
      tenant: EMPTY_TENANT,
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('free');
  });

  it('admits paid pack on paid tier with active entitlement', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'active'),
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('paid');
  });

  it('admits paid pack on paid tier with trial entitlement (trial-active)', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'trial'),
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('paid');
  });

  it('admits enterprise pack on enterprise tier with active + contractRef', () => {
    const result = tierGate({
      pack: { kind: 'enterprise', sku: 'sku.ent' },
      tenant: tenantWith('sku.ent', 'active', { contractRef: 'MSA-001' }),
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('enterprise');
  });

  it('omitted currentInstalledCount defaults to 0 and admits', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'active'),
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('paid');
  });
});

describe('tierGate — failure cases', () => {
  it('paid pack with no entitlement → reason no-entitlement', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: EMPTY_TENANT,
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.tier).toBe('none');
    expect(result.reason).toBe('no-entitlement');
  });

  it('paid pack with lapsed entitlement → reason lapsed', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'lapsed'),
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('lapsed');
  });

  it('paid pack with revoked entitlement → reason revoked', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'revoked'),
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('revoked');
  });

  it('paid pack with pending entitlement → reason pending', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'pending'),
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('pending');
  });

  it('enterprise pack with trial entitlement → reason trial-expired', () => {
    const result = tierGate({
      pack: { kind: 'enterprise', sku: 'sku.ent' },
      tenant: tenantWith('sku.ent', 'trial', { contractRef: 'MSA-001' }),
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('trial-expired');
  });

  it('enterprise pack with active but missing contractRef → reason no-entitlement', () => {
    const result = tierGate({
      pack: { kind: 'enterprise', sku: 'sku.ent' },
      tenant: tenantWith('sku.ent', 'active'),
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-entitlement');
    expect(result.detail).toContain('contractRef');
  });

  it('paid-per-tenant pack with missing sku → reason no-entitlement', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant' },
      tenant: EMPTY_TENANT,
      policy: DEFAULT_TIER_POLICY,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-entitlement');
  });

  it('free tier hitting the open-packs cap → reason limit-exceeded', () => {
    const result = tierGate({
      pack: { kind: 'open' },
      tenant: EMPTY_TENANT,
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 10, // DEFAULT_TIER_LIMITS.free.maxOpenPacks === 10
    });
    expect(result.ok).toBe(false);
    expect(result.tier).toBe('free');
    expect(result.reason).toBe('limit-exceeded');
  });

  it('free tier just under cap admits', () => {
    const result = tierGate({
      pack: { kind: 'open' },
      tenant: EMPTY_TENANT,
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 9,
    });
    expect(result.ok).toBe(true);
  });

  it('paid tier with unlimited paid packs admits at high counts', () => {
    const result = tierGate({
      pack: { kind: 'paid-per-tenant', sku: 'sku.pro' },
      tenant: tenantWith('sku.pro', 'active'),
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 9_999,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('paid');
  });

  it('enterprise tier admits enterprise pack at high counts', () => {
    const result = tierGate({
      pack: { kind: 'enterprise', sku: 'sku.ent' },
      tenant: tenantWith('sku.ent', 'active', { contractRef: 'MSA-001' }),
      policy: DEFAULT_TIER_POLICY,
      currentInstalledCount: 1_234,
    });
    expect(result.ok).toBe(true);
    expect(result.tier).toBe('enterprise');
  });
});
