// packages/marketplace-refunds/src/disputes/response-builder.test.ts
// T-545 — `buildDisputeEvidence` tests.

import { describe, expect, it } from 'vitest';
import type { DisputeEvent } from './handler.js';
import { buildDisputeEvidence } from './response-builder.js';

const BASE_EVENT: DisputeEvent = {
  id: 'dp_test_1',
  chargeId: 'ch_test_1',
  tenantId: 'tenant-1',
  sku: 'sku.news.pro',
  amountCents: 5000,
  status: 'needs_response',
  reason: 'fraudulent',
  createdAt: '2026-05-14T09:00:00.000Z',
};

describe('buildDisputeEvidence', () => {
  it('builds evidence with usage metrics + entitlement history + receipt', () => {
    const evidence = buildDisputeEvidence({
      event: BASE_EVENT,
      entitlementHistory: ['2026-01-01 trial-granted', '2026-01-08 active'],
      usageMetrics: { installCount: 3, activationCount: 2, clipMountCount: 47 },
    });
    expect(evidence.serviceDate).toBe('2026-05-14T09:00:00.000Z');
    expect(evidence.receipt).toBe('charge=ch_test_1 amount=$50.00 sku=sku.news.pro');
    expect(evidence.serviceDocumentation).toContain('sku=sku.news.pro');
    expect(evidence.serviceDocumentation).toContain('tenant=tenant-1');
    expect(evidence.serviceDocumentation).toContain('installs=3, activations=2, clipMounts=47');
    expect(evidence.serviceDocumentation).toContain('2026-01-01 trial-granted');
    expect(evidence.serviceDocumentation).toContain('2026-01-08 active');
  });

  it('serviceDate matches event.createdAt verbatim', () => {
    const evidence = buildDisputeEvidence({
      event: { ...BASE_EVENT, createdAt: '2027-03-15T12:30:00.000Z' },
      entitlementHistory: [],
      usageMetrics: { installCount: 0, activationCount: 0, clipMountCount: 0 },
    });
    expect(evidence.serviceDate).toBe('2027-03-15T12:30:00.000Z');
  });

  it('empty entitlement history yields a placeholder line', () => {
    const evidence = buildDisputeEvidence({
      event: BASE_EVENT,
      entitlementHistory: [],
      usageMetrics: { installCount: 0, activationCount: 0, clipMountCount: 0 },
    });
    expect(evidence.serviceDocumentation).toContain('No entitlement history recorded.');
  });

  it('omitted customerInfo yields null customer fields', () => {
    const evidence = buildDisputeEvidence({
      event: BASE_EVENT,
      entitlementHistory: ['2026-01-01 trial-granted'],
      usageMetrics: { installCount: 1, activationCount: 1, clipMountCount: 10 },
    });
    expect(evidence.customerName).toBeNull();
    expect(evidence.customerEmail).toBeNull();
    expect(evidence.billingAddress).toBeNull();
    expect(evidence.customerCommunication).toBeNull();
  });

  it('passed customerInfo flows through to evidence', () => {
    const evidence = buildDisputeEvidence({
      event: BASE_EVENT,
      entitlementHistory: [],
      usageMetrics: { installCount: 0, activationCount: 0, clipMountCount: 0 },
      customerInfo: {
        customerName: 'Acme Corp',
        customerEmail: 'billing@acme.example',
        billingAddress: '1 Acme Way, Springfield',
        customerCommunication: 'Email thread re: pack install on 2026-02-01',
      },
    });
    expect(evidence.customerName).toBe('Acme Corp');
    expect(evidence.customerEmail).toBe('billing@acme.example');
    expect(evidence.billingAddress).toBe('1 Acme Way, Springfield');
    expect(evidence.customerCommunication).toBe('Email thread re: pack install on 2026-02-01');
  });

  it('formats amount in dollars with two decimals', () => {
    const evidence = buildDisputeEvidence({
      event: { ...BASE_EVENT, amountCents: 12_345 },
      entitlementHistory: [],
      usageMetrics: { installCount: 0, activationCount: 0, clipMountCount: 0 },
    });
    expect(evidence.receipt).toContain('amount=$123.45');
  });
});
