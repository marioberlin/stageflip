// packages/pack-trial/src/state.test.ts

import { describe, expect, it } from 'vitest';

import { evaluateTrialPolicy } from './state.js';

const NOW = Date.parse('2026-05-13T12:00:00Z');

describe('evaluateTrialPolicy', () => {
  it("returns 'none' for null entitlement", () => {
    expect(evaluateTrialPolicy({ entitlement: null, nowMs: NOW })).toBe('none');
  });

  it("returns 'none' for an active (non-trial) entitlement", () => {
    expect(evaluateTrialPolicy({ entitlement: { status: 'active' }, nowMs: NOW })).toBe('none');
  });

  it("returns 'none' for a lapsed entitlement", () => {
    expect(evaluateTrialPolicy({ entitlement: { status: 'lapsed' }, nowMs: NOW })).toBe('none');
  });

  it("returns 'trial-active' for a trial entitlement with no expiresAt (perpetual trial)", () => {
    expect(evaluateTrialPolicy({ entitlement: { status: 'trial' }, nowMs: NOW })).toBe(
      'trial-active',
    );
  });

  it("returns 'trial-active' for a trial entitlement that expires in the future", () => {
    expect(
      evaluateTrialPolicy({
        entitlement: { status: 'trial', expiresAt: '2026-12-31T00:00:00Z' },
        nowMs: NOW,
      }),
    ).toBe('trial-active');
  });

  it("returns 'trial-expired' for a trial entitlement past its expiresAt", () => {
    expect(
      evaluateTrialPolicy({
        entitlement: { status: 'trial', expiresAt: '2026-01-01T00:00:00Z' },
        nowMs: NOW,
      }),
    ).toBe('trial-expired');
  });

  it("returns 'trial-active' for a trial entitlement with unparseable expiresAt (degrades, doesn't throw)", () => {
    expect(
      evaluateTrialPolicy({
        entitlement: { status: 'trial', expiresAt: 'not-a-date' },
        nowMs: NOW,
      }),
    ).toBe('trial-active');
  });

  it("treats nowMs === expiresMs as 'trial-expired' (inclusive upper bound)", () => {
    const exact = Date.parse('2026-05-13T12:00:00Z');
    expect(
      evaluateTrialPolicy({
        entitlement: { status: 'trial', expiresAt: '2026-05-13T12:00:00Z' },
        nowMs: exact,
      }),
    ).toBe('trial-expired');
  });
});
