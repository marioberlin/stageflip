// packages/marketplace-tier/src/resolver/tier-resolver.test.ts
// T-543 — `resolveTenantTier` unit tests. Cover the ADR-013 §D3
// truth table: open → free; paid+active → paid; paid+trial → paid;
// paid+lapsed/revoked/pending/missing → none; enterprise+active+
// contractRef → enterprise; enterprise without contractRef → none.

import { describe, expect, it } from 'vitest';
import { type PackLicenseInput, type TenantTierInput, resolveTenantTier } from './tier-resolver.js';

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

describe('resolveTenantTier', () => {
  it('open pack resolves to free with no entitlement', () => {
    const pack: PackLicenseInput = { kind: 'open' };
    expect(resolveTenantTier(EMPTY_TENANT, pack)).toBe('free');
  });

  it('open pack resolves to free even with unrelated entitlements', () => {
    const pack: PackLicenseInput = { kind: 'open' };
    expect(resolveTenantTier(tenantWith('sku.unrelated', 'active'), pack)).toBe('free');
  });

  it('paid pack with active entitlement resolves to paid', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant', sku: 'sku.pro' };
    expect(resolveTenantTier(tenantWith('sku.pro', 'active'), pack)).toBe('paid');
  });

  it('paid pack with trial entitlement resolves to paid', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant', sku: 'sku.pro' };
    expect(resolveTenantTier(tenantWith('sku.pro', 'trial'), pack)).toBe('paid');
  });

  it('paid pack with lapsed entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant', sku: 'sku.pro' };
    expect(resolveTenantTier(tenantWith('sku.pro', 'lapsed'), pack)).toBe('none');
  });

  it('paid pack with revoked entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant', sku: 'sku.pro' };
    expect(resolveTenantTier(tenantWith('sku.pro', 'revoked'), pack)).toBe('none');
  });

  it('paid pack with pending entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant', sku: 'sku.pro' };
    expect(resolveTenantTier(tenantWith('sku.pro', 'pending'), pack)).toBe('none');
  });

  it('paid pack with no matching entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant', sku: 'sku.pro' };
    expect(resolveTenantTier(EMPTY_TENANT, pack)).toBe('none');
  });

  it('paid pack with missing sku resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'paid-per-tenant' };
    expect(resolveTenantTier(tenantWith('sku.pro', 'active'), pack)).toBe('none');
  });

  it('enterprise pack with active + contractRef resolves to enterprise', () => {
    const pack: PackLicenseInput = { kind: 'enterprise', sku: 'sku.ent' };
    expect(
      resolveTenantTier(tenantWith('sku.ent', 'active', { contractRef: 'MSA-2026-001' }), pack),
    ).toBe('enterprise');
  });

  it('enterprise pack with active but missing contractRef resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'enterprise', sku: 'sku.ent' };
    expect(resolveTenantTier(tenantWith('sku.ent', 'active'), pack)).toBe('none');
  });

  it('enterprise pack with active + empty contractRef resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'enterprise', sku: 'sku.ent' };
    expect(resolveTenantTier(tenantWith('sku.ent', 'active', { contractRef: '' }), pack)).toBe(
      'none',
    );
  });

  it('enterprise pack with lapsed entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'enterprise', sku: 'sku.ent' };
    expect(
      resolveTenantTier(tenantWith('sku.ent', 'lapsed', { contractRef: 'MSA-2026-001' }), pack),
    ).toBe('none');
  });

  it('enterprise pack with trial entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'enterprise', sku: 'sku.ent' };
    expect(
      resolveTenantTier(tenantWith('sku.ent', 'trial', { contractRef: 'MSA-2026-001' }), pack),
    ).toBe('none');
  });

  it('enterprise pack with revoked entitlement resolves to none', () => {
    const pack: PackLicenseInput = { kind: 'enterprise', sku: 'sku.ent' };
    expect(
      resolveTenantTier(tenantWith('sku.ent', 'revoked', { contractRef: 'MSA-2026-001' }), pack),
    ).toBe('none');
  });
});
