// packages/marketplace-conversion/src/planner/conversion-planner.test.ts
// T-544 — `planConversion` decision-table tests.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CHURN_STRATEGY } from '../churn/strategy.js';
import type { ConversionEvent } from '../events/conversion-event.js';
import {
  type ConversionEntitlementStatus,
  type ConversionPlannerInput,
  planConversion,
} from './conversion-planner.js';

function eventOf(
  kind: ConversionEvent['kind'],
  extras: Partial<ConversionEvent> = {},
): ConversionEvent {
  return {
    kind,
    tenantId: 'tenant-1',
    sku: 'sku.news.pro',
    at: '2026-05-14T09:00:00.000Z',
    metadata: {},
    ...extras,
  };
}

function inputOf(
  kind: ConversionEvent['kind'],
  status: ConversionEntitlementStatus | null,
  overrides: Partial<ConversionPlannerInput> = {},
): ConversionPlannerInput {
  return {
    event: eventOf(kind),
    currentEntitlementStatus: status,
    stripeCustomerId: 'cus_test',
    stripePriceId: 'price_test',
    ...overrides,
  };
}

describe('planConversion — trial-to-paid', () => {
  it('trial status → create-checkout-session, expect active', () => {
    const out = planConversion(inputOf('trial-to-paid', 'trial'));
    expect(out.action.kind).toBe('create-checkout-session');
    if (out.action.kind === 'create-checkout-session') {
      expect(out.action.priceId).toBe('price_test');
      expect(out.action.customerId).toBe('cus_test');
      expect(out.action.metadata.conversionEventKind).toBe('trial-to-paid');
      expect(out.action.metadata.tenantId).toBe('tenant-1');
      expect(out.action.metadata.sku).toBe('sku.news.pro');
    }
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('active status → noop already-active', () => {
    const out = planConversion(inputOf('trial-to-paid', 'active'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'already-active' });
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('pending status → noop pending-stripe', () => {
    const out = planConversion(inputOf('trial-to-paid', 'pending'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'pending-stripe' });
    expect(out.expectedTerminalStatus).toBe('pending');
  });

  it('lapsed status → create-checkout-session', () => {
    const out = planConversion(inputOf('trial-to-paid', 'lapsed'));
    expect(out.action.kind).toBe('create-checkout-session');
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('null status (fresh) → create-checkout-session with null customerId', () => {
    const out = planConversion(inputOf('trial-to-paid', null, { stripeCustomerId: null }));
    expect(out.action.kind).toBe('create-checkout-session');
    if (out.action.kind === 'create-checkout-session') {
      expect(out.action.customerId).toBeNull();
    }
  });

  it('merges event.metadata into checkout-session metadata', () => {
    const out = planConversion({
      ...inputOf('trial-to-paid', 'trial'),
      event: eventOf('trial-to-paid', {
        metadata: { campaign: 'spring-2026', source: 'in-app' },
      }),
    });
    expect(out.action.kind).toBe('create-checkout-session');
    if (out.action.kind === 'create-checkout-session') {
      expect(out.action.metadata.campaign).toBe('spring-2026');
      expect(out.action.metadata.source).toBe('in-app');
      expect(out.action.metadata.conversionEventKind).toBe('trial-to-paid');
    }
  });
});

describe('planConversion — trial-expired', () => {
  it('active status → noop already-converted', () => {
    const out = planConversion(inputOf('trial-expired', 'active'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'already-converted' });
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('trial status → create-checkout-session', () => {
    const out = planConversion(inputOf('trial-expired', 'trial'));
    expect(out.action.kind).toBe('create-checkout-session');
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('null status → create-checkout-session', () => {
    const out = planConversion(inputOf('trial-expired', null));
    expect(out.action.kind).toBe('create-checkout-session');
  });

  it('pending → noop pending-stripe', () => {
    const out = planConversion(inputOf('trial-expired', 'pending'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'pending-stripe' });
  });

  it('revoked → create-checkout-session (re-subscribe path)', () => {
    const out = planConversion(inputOf('trial-expired', 'revoked'));
    expect(out.action.kind).toBe('create-checkout-session');
    expect(out.expectedTerminalStatus).toBe('active');
  });
});

describe('planConversion — lapsed-recovered', () => {
  it('active status → noop already-active', () => {
    const out = planConversion(inputOf('lapsed-recovered', 'active'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'already-active' });
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('lapsed status (first attempt) → churn-recovery-retry with base backoff', () => {
    const out = planConversion(inputOf('lapsed-recovered', 'lapsed'));
    expect(out.action.kind).toBe('churn-recovery-retry');
    if (out.action.kind === 'churn-recovery-retry') {
      expect(out.action.backoffMs).toBe(DEFAULT_CHURN_STRATEGY.baseBackoffMs);
    }
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('lapsed status (second attempt) → churn-recovery-retry with grown backoff', () => {
    const out = planConversion(inputOf('lapsed-recovered', 'lapsed', { retryCount: 1 }));
    expect(out.action.kind).toBe('churn-recovery-retry');
    if (out.action.kind === 'churn-recovery-retry') {
      expect(out.action.backoffMs).toBe(DEFAULT_CHURN_STRATEGY.baseBackoffMs * 2);
    }
  });

  it('retry count >= maxRetries → noop churn-final', () => {
    const out = planConversion(
      inputOf('lapsed-recovered', 'lapsed', {
        retryCount: DEFAULT_CHURN_STRATEGY.maxRetries,
      }),
    );
    expect(out.action).toEqual({ kind: 'noop', reason: 'churn-final' });
    expect(out.expectedTerminalStatus).toBe('lapsed');
  });

  it('revoked status drives churn-recovery-retry then noop with revoked terminal', () => {
    const before = planConversion(inputOf('lapsed-recovered', 'revoked', { retryCount: 0 }));
    expect(before.action.kind).toBe('churn-recovery-retry');

    const after = planConversion(
      inputOf('lapsed-recovered', 'revoked', {
        retryCount: DEFAULT_CHURN_STRATEGY.maxRetries,
      }),
    );
    expect(after.action).toEqual({ kind: 'noop', reason: 'churn-final' });
    expect(after.expectedTerminalStatus).toBe('revoked');
  });

  it('pending status → noop pending-stripe', () => {
    const out = planConversion(inputOf('lapsed-recovered', 'pending'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'pending-stripe' });
    expect(out.expectedTerminalStatus).toBe('pending');
  });

  it('trial status → noop trial-sibling', () => {
    const out = planConversion(inputOf('lapsed-recovered', 'trial'));
    expect(out.action).toEqual({ kind: 'noop', reason: 'trial-sibling' });
    expect(out.expectedTerminalStatus).toBe('active');
  });

  it('null status → noop no-entitlement', () => {
    const out = planConversion(inputOf('lapsed-recovered', null));
    expect(out.action).toEqual({ kind: 'noop', reason: 'no-entitlement' });
    expect(out.expectedTerminalStatus).toBe('revoked');
  });

  it('custom strategy overrides default backoff', () => {
    const customStrategy = {
      maxRetries: 5,
      baseBackoffMs: 1000,
      maxBackoffMs: 10_000,
      nextBackoff: (n: number): number => 1000 * (n + 1),
    };
    const out = planConversion(
      inputOf('lapsed-recovered', 'lapsed', { retryCount: 2 }),
      customStrategy,
    );
    expect(out.action.kind).toBe('churn-recovery-retry');
    if (out.action.kind === 'churn-recovery-retry') {
      expect(out.action.backoffMs).toBe(3000);
    }
  });
});
