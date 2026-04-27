// packages/rate-limit/src/config.test.ts
// T-263 ACs #1–#3 — defaults pinned, env overrides honoured, invalid input throws.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BUCKET_PARAMS, TIERS, resolveConfig } from './config.js';

describe('config (AC #1)', () => {
  it('exports spec-pinned defaults per D-T263-3', () => {
    expect(DEFAULT_BUCKET_PARAMS.user).toEqual({ capacity: 60, refillPerSecond: 1 });
    expect(DEFAULT_BUCKET_PARAMS.org).toEqual({ capacity: 600, refillPerSecond: 10 });
    expect(DEFAULT_BUCKET_PARAMS.apiKey).toEqual({ capacity: 300, refillPerSecond: 5 });
  });

  it('exposes the three tier identifiers in deterministic order', () => {
    expect(TIERS).toEqual(['user', 'org', 'apiKey']);
  });

  it('returns defaults when no env vars are set', () => {
    expect(resolveConfig({})).toEqual(DEFAULT_BUCKET_PARAMS);
  });
});

describe('config env-var overrides (AC #2)', () => {
  it('overrides USER_CAPACITY when set', () => {
    const cfg = resolveConfig({ STAGEFLIP_RATE_LIMIT_USER_CAPACITY: '120' });
    expect(cfg.user.capacity).toBe(120);
    expect(cfg.user.refillPerSecond).toBe(1); // refill default preserved
  });

  it('overrides ORG_REFILL when set', () => {
    const cfg = resolveConfig({ STAGEFLIP_RATE_LIMIT_ORG_REFILL: '20' });
    expect(cfg.org.refillPerSecond).toBe(20);
    expect(cfg.org.capacity).toBe(600);
  });

  it('overrides APIKEY_CAPACITY (using APIKEY token, not APIKEYS)', () => {
    const cfg = resolveConfig({ STAGEFLIP_RATE_LIMIT_APIKEY_CAPACITY: '900' });
    expect(cfg.apiKey.capacity).toBe(900);
  });

  it('ignores empty-string env values (treats them as unset)', () => {
    const cfg = resolveConfig({ STAGEFLIP_RATE_LIMIT_USER_CAPACITY: '' });
    expect(cfg.user.capacity).toBe(60);
  });

  it('does not mutate other tiers when one is overridden', () => {
    const cfg = resolveConfig({ STAGEFLIP_RATE_LIMIT_USER_CAPACITY: '5' });
    expect(cfg.org).toEqual(DEFAULT_BUCKET_PARAMS.org);
    expect(cfg.apiKey).toEqual(DEFAULT_BUCKET_PARAMS.apiKey);
  });
});

describe('config invalid env values (AC #3)', () => {
  it('throws on non-numeric value', () => {
    expect(() => resolveConfig({ STAGEFLIP_RATE_LIMIT_USER_CAPACITY: 'abc' })).toThrow(
      /not a positive finite number/,
    );
  });

  it('throws on zero', () => {
    expect(() => resolveConfig({ STAGEFLIP_RATE_LIMIT_USER_REFILL: '0' })).toThrow(
      /not a positive finite number/,
    );
  });

  it('throws on negative', () => {
    expect(() => resolveConfig({ STAGEFLIP_RATE_LIMIT_ORG_CAPACITY: '-5' })).toThrow(
      /not a positive finite number/,
    );
  });

  it('throws on NaN-producing value', () => {
    expect(() => resolveConfig({ STAGEFLIP_RATE_LIMIT_APIKEY_REFILL: 'NaN' })).toThrow(
      /not a positive finite number/,
    );
  });

  it('throws on Infinity', () => {
    expect(() => resolveConfig({ STAGEFLIP_RATE_LIMIT_APIKEY_CAPACITY: 'Infinity' })).toThrow(
      /not a positive finite number/,
    );
  });
});
