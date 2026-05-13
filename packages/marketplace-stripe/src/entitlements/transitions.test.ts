// packages/marketplace-stripe/src/entitlements/transitions.test.ts
// T-537 — TenantEntitlement state-machine edges per ADR-013 §D4.

import { describe, expect, it } from 'vitest';

import { assertTransition, nextStatus } from './transitions.js';

describe('nextStatus', () => {
  it('pending --checkout-completed--> active', () => {
    expect(nextStatus('pending', 'checkout-completed')).toBe('active');
  });

  it('active --subscription-past-due--> lapsed', () => {
    expect(nextStatus('active', 'subscription-past-due')).toBe('lapsed');
  });

  it('active --payment-failed-final--> lapsed', () => {
    expect(nextStatus('active', 'payment-failed-final')).toBe('lapsed');
  });

  it('active --subscription-canceled--> revoked', () => {
    expect(nextStatus('active', 'subscription-canceled')).toBe('revoked');
  });

  it('lapsed --subscription-renewed--> active (resubscribe path)', () => {
    expect(nextStatus('lapsed', 'subscription-renewed')).toBe('active');
  });

  it('lapsed --subscription-canceled--> revoked', () => {
    expect(nextStatus('lapsed', 'subscription-canceled')).toBe('revoked');
  });

  it('revoked is terminal — every intent returns null', () => {
    expect(nextStatus('revoked', 'checkout-completed')).toBeNull();
    expect(nextStatus('revoked', 'subscription-renewed')).toBeNull();
    expect(nextStatus('revoked', 'subscription-past-due')).toBeNull();
    expect(nextStatus('revoked', 'subscription-canceled')).toBeNull();
    expect(nextStatus('revoked', 'payment-failed-final')).toBeNull();
  });

  it('illegal edges return null (e.g. lapsed --checkout-completed--> ⊥)', () => {
    expect(nextStatus('lapsed', 'checkout-completed')).toBeNull();
    expect(nextStatus('pending', 'subscription-past-due')).toBeNull();
    expect(nextStatus('pending', 'payment-failed-final')).toBeNull();
  });

  it('active --subscription-renewed--> active (idempotent renewal)', () => {
    expect(nextStatus('active', 'subscription-renewed')).toBe('active');
  });
});

describe('assertTransition', () => {
  it('returns next on legal edge', () => {
    expect(assertTransition('pending', 'checkout-completed')).toBe('active');
  });

  it('throws on illegal edge', () => {
    expect(() => assertTransition('revoked', 'subscription-renewed')).toThrow(/illegal/);
    expect(() => assertTransition('lapsed', 'checkout-completed')).toThrow(/illegal/);
  });
});
