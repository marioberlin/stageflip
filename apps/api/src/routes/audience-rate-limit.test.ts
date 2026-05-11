// apps/api/src/routes/audience-rate-limit.test.ts
// T-453 — Tests for `TenantRateLimiter` + `VoterRateLimiter`. Asserts
// the token-bucket admits up to `2× ratePerSecond` burst and refuses
// further; bucket refills at the configured rate; per-key isolation.

import { describe, expect, it } from 'vitest';

import {
  TenantRateLimiter,
  TokenBucketRateLimiter,
  VoterRateLimiter,
} from './audience-rate-limit.js';

describe('TokenBucketRateLimiter — invariants', () => {
  it('rejects non-positive rates', () => {
    expect(() => new TokenBucketRateLimiter({ ratePerSecond: 0, burst: 1 })).toThrow();
    expect(() => new TokenBucketRateLimiter({ ratePerSecond: 1, burst: 0 })).toThrow();
  });

  it('first call starts with a full bucket — admits up to `burst` immediately', () => {
    const t = 1_000_000;
    const limiter = new TokenBucketRateLimiter({
      ratePerSecond: 10,
      burst: 3,
      now: () => t,
    });
    expect(limiter.tryConsume('k').accepted).toBe(true);
    expect(limiter.tryConsume('k').accepted).toBe(true);
    expect(limiter.tryConsume('k').accepted).toBe(true);
    const denied = limiter.tryConsume('k');
    expect(denied.accepted).toBe(false);
    expect(denied.rejectReason).toBe('rate-limited');
  });

  it('refills at the configured rate', () => {
    let t = 1_000_000;
    const limiter = new TokenBucketRateLimiter({
      ratePerSecond: 10, // 1 token per 100 ms
      burst: 1,
      now: () => t,
    });
    expect(limiter.tryConsume('k').accepted).toBe(true);
    expect(limiter.tryConsume('k').accepted).toBe(false);
    t += 100; // 100 ms later — exactly one token refilled.
    expect(limiter.tryConsume('k').accepted).toBe(true);
    expect(limiter.tryConsume('k').accepted).toBe(false);
  });

  it('isolates buckets per key', () => {
    const t = 1_000_000;
    const limiter = new TokenBucketRateLimiter({
      ratePerSecond: 10,
      burst: 1,
      now: () => t,
    });
    expect(limiter.tryConsume('a').accepted).toBe(true);
    expect(limiter.tryConsume('a').accepted).toBe(false);
    // 'b' has its own bucket — fresh.
    expect(limiter.tryConsume('b').accepted).toBe(true);
  });

  it('caps the bucket at `burst` even after a long idle', () => {
    let t = 1_000_000;
    const limiter = new TokenBucketRateLimiter({
      ratePerSecond: 10,
      burst: 5,
      now: () => t,
    });
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('k').accepted).toBe(true);
    }
    expect(limiter.tryConsume('k').accepted).toBe(false);
    t += 60_000; // an hour of idle... bucket cannot exceed burst.
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume('k').accepted).toBe(true);
    }
    expect(limiter.tryConsume('k').accepted).toBe(false);
  });
});

describe('TenantRateLimiter — ADR-009 §D3 burst=2× rate', () => {
  it('admits up to 2× maxIngestRateHz on the cold-burst, then refuses', () => {
    const t = 1_000_000;
    const limiter = new TenantRateLimiter({ maxIngestRateHz: 5, now: () => t });
    // burst = 10
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume('tenant-1').accepted).toBe(true);
    }
    const denied = limiter.tryConsume('tenant-1');
    expect(denied.accepted).toBe(false);
    expect(denied.rejectReason).toBe('rate-limited');
  });

  it('refills at maxIngestRateHz', () => {
    let t = 1_000_000;
    const limiter = new TenantRateLimiter({ maxIngestRateHz: 100, now: () => t });
    // Drain the bucket (burst=200).
    for (let i = 0; i < 200; i++) limiter.tryConsume('tenant-1');
    expect(limiter.tryConsume('tenant-1').accepted).toBe(false);
    // 10 ms later — refills by 100 * 0.01 = 1 token.
    t += 10;
    expect(limiter.tryConsume('tenant-1').accepted).toBe(true);
    expect(limiter.tryConsume('tenant-1').accepted).toBe(false);
  });
});

describe('VoterRateLimiter — hardcoded 10 Hz / 20 burst per ADR-009 §D3', () => {
  it('admits up to 20 on the cold burst', () => {
    const t = 1_000_000;
    const limiter = new VoterRateLimiter({ now: () => t });
    for (let i = 0; i < 20; i++) {
      expect(limiter.tryConsume('voter-1').accepted).toBe(true);
    }
    expect(limiter.tryConsume('voter-1').accepted).toBe(false);
  });

  it('isolates buckets per voter', () => {
    const t = 1_000_000;
    const limiter = new VoterRateLimiter({ now: () => t });
    for (let i = 0; i < 20; i++) limiter.tryConsume('voter-1');
    expect(limiter.tryConsume('voter-1').accepted).toBe(false);
    expect(limiter.tryConsume('voter-2').accepted).toBe(true);
  });
});
