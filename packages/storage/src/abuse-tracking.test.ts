// packages/storage/src/abuse-tracking.test.ts
// T-458 — Schema round-trip + reject-malformed coverage for the
// AbuseTrackingStore facet's wire-format types (AbuseSource / AbuseFlag /
// AbuseCounter).

import { describe, expect, it } from 'vitest';

import {
  ABUSE_COOLDOWN_MS,
  ABUSE_ESCALATION_WINDOW_MS,
  DEFAULT_ABUSE_THRESHOLD,
  DEFAULT_ABUSE_WINDOW_MS,
  abuseCounterSchema,
  abuseFlagSchema,
  abuseSourceSchema,
} from './abuse-tracking.js';

describe('abuseSourceSchema', () => {
  it('round-trips a voter-token source', () => {
    const v = { kind: 'voter-token' as const, value: 'voter-1' };
    expect(abuseSourceSchema.parse(v)).toEqual(v);
  });

  it('round-trips an ip source', () => {
    const v = { kind: 'ip' as const, value: '10.0.0.1' };
    expect(abuseSourceSchema.parse(v)).toEqual(v);
  });

  it('rejects an unknown kind', () => {
    expect(() => abuseSourceSchema.parse({ kind: 'mystery', value: 'x' })).toThrow();
  });

  it('rejects an empty value', () => {
    expect(() => abuseSourceSchema.parse({ kind: 'ip', value: '' })).toThrow();
  });
});

describe('abuseFlagSchema', () => {
  it('accepts every legal escalation level', () => {
    for (const level of [0, 1, 2, 3] as const) {
      expect(abuseFlagSchema.parse({ level, expiresAt: 1_000 }).level).toBe(level);
    }
  });

  it('rejects an unknown level', () => {
    expect(() => abuseFlagSchema.parse({ level: 4, expiresAt: 1_000 })).toThrow();
  });

  it('rejects a negative expiresAt', () => {
    expect(() => abuseFlagSchema.parse({ level: 1, expiresAt: -1 })).toThrow();
  });
});

describe('abuseCounterSchema', () => {
  it('round-trips a snapshot', () => {
    const c = { hits: 3, windowStart: 1_700_000_000_000 };
    expect(abuseCounterSchema.parse(c)).toEqual(c);
  });

  it('rejects negative hits', () => {
    expect(() => abuseCounterSchema.parse({ hits: -1, windowStart: 0 })).toThrow();
  });
});

describe('cooldown / window constants', () => {
  it('match ADR-009 §D3 escalation table', () => {
    expect(ABUSE_COOLDOWN_MS[0]).toBe(0);
    expect(ABUSE_COOLDOWN_MS[1]).toBe(30 * 1000);
    expect(ABUSE_COOLDOWN_MS[2]).toBe(5 * 60 * 1000);
    expect(ABUSE_COOLDOWN_MS[3]).toBe(60 * 60 * 1000);
  });

  it('default window + threshold defaults are 60 s / 10 hits', () => {
    expect(DEFAULT_ABUSE_WINDOW_MS).toBe(60 * 1000);
    expect(DEFAULT_ABUSE_THRESHOLD).toBe(10);
  });

  it('escalation window is 1 h', () => {
    expect(ABUSE_ESCALATION_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});
