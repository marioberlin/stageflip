// packages/rate-limit/src/limiter.test.ts
// T-263 ACs #4–#10 — limiter behaviours.

import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryRedis } from './in-memory-redis.js';
import { RateLimiter } from './limiter.js';

/** Build a limiter with deterministic tiny defaults so tests are precise. */
function makeLimiter(opts?: { now?: () => number; redis?: InMemoryRedis }) {
  const redis = opts?.redis ?? new InMemoryRedis();
  if (opts?.now) redis.setClock(opts.now);
  const limiter = new RateLimiter({
    redis,
    now: opts?.now ?? (() => Date.now()),
    config: {
      // 2-token capacity, 1 token/sec — easy to reason about.
      user: { capacity: 2, refillPerSecond: 1 },
      org: { capacity: 3, refillPerSecond: 1 },
      apiKey: { capacity: 2, refillPerSecond: 1 },
    },
  });
  return { limiter, redis };
}

describe('RateLimiter constructor (AC #4)', () => {
  it('constructs with a RedisLike client', () => {
    const redis = new InMemoryRedis();
    const limiter = new RateLimiter({ redis });
    expect(limiter).toBeInstanceOf(RateLimiter);
    expect(limiter.getParams('user')).toEqual({ capacity: 60, refillPerSecond: 1 });
  });

  it('honours config overrides per tier', () => {
    const redis = new InMemoryRedis();
    const limiter = new RateLimiter({
      redis,
      config: { user: { capacity: 9, refillPerSecond: 2 } },
    });
    expect(limiter.getParams('user')).toEqual({ capacity: 9, refillPerSecond: 2 });
    expect(limiter.getParams('org')).toEqual({ capacity: 600, refillPerSecond: 10 });
  });
});

describe('consume — happy path (AC #5)', () => {
  it('allows a request when all buckets have ≥1 token; consumes one from each', async () => {
    const now = 1_000_000;
    const { limiter, redis } = makeLimiter({ now: () => now });
    const r = await limiter.consume({ user: 'u_a', org: 'o_a' });
    expect(r).toEqual({ allowed: true });
    // After one consume: user starts at 2 → 1, org starts at 3 → 2.
    const userRaw = await redis.get('ratelimit:user:u_a');
    expect(userRaw).not.toBeNull();
    const userState = JSON.parse(userRaw as string) as { tokens: number; updatedAt: number };
    expect(userState.tokens).toBe(1);
    expect(userState.updatedAt).toBe(now);
    const orgRaw = await redis.get('ratelimit:org:o_a');
    const orgState = JSON.parse(orgRaw as string) as { tokens: number; updatedAt: number };
    expect(orgState.tokens).toBe(2);
  });

  it('refills tokens proportional to elapsed time, capped at capacity', async () => {
    let now = 0;
    const { limiter } = makeLimiter({ now: () => now });
    // Drain user (capacity 2): two consumes succeed.
    await limiter.consume({ user: 'u_a', org: 'o_a' });
    await limiter.consume({ user: 'u_a', org: 'o_a' });
    // Third would fail at user.
    const r1 = await limiter.consume({ user: 'u_a', org: 'o_a' });
    expect(r1.allowed).toBe(false);
    // Advance 1.5s — refills 1.5 user tokens (cap 2).
    now += 1500;
    const r2 = await limiter.consume({ user: 'u_a', org: 'o_a' });
    expect(r2.allowed).toBe(true);
  });
});

describe('consume — rejection (AC #6)', () => {
  it('rejects with tier and retryAfterMs when the user bucket is empty', async () => {
    const now = 0;
    const { limiter } = makeLimiter({ now: () => now });
    await limiter.consume({ user: 'u_a', org: 'o_a' }); // 1 left
    await limiter.consume({ user: 'u_a', org: 'o_a' }); // 0 left
    const r = await limiter.consume({ user: 'u_a', org: 'o_a' });
    expect(r.allowed).toBe(false);
    if (r.allowed) throw new Error('unreachable');
    expect(r.tier).toBe('user');
    // 0 tokens, deficit 1, refill 1/sec → ~1000ms.
    expect(r.retryAfterMs).toBe(1000);
  });
});

describe('consume — longest-retry semantics (AC #7)', () => {
  it('returns the bucket with the longest retry when multiple are exhausted', async () => {
    const now = 0;
    const redis = new InMemoryRedis();
    const limiter = new RateLimiter({
      redis,
      now: () => now,
      // user: refills fast (1 tok/sec); org: refills slow (0.1 tok/sec).
      config: {
        user: { capacity: 1, refillPerSecond: 1 },
        org: { capacity: 1, refillPerSecond: 0.1 },
        apiKey: { capacity: 1, refillPerSecond: 1 },
      },
    });
    // Drain both buckets.
    const r0 = await limiter.consume({ user: 'u_a', org: 'o_a' });
    expect(r0.allowed).toBe(true);
    // Now both at 0; user refill 1s, org refill 10s. Caller should wait 10s.
    const r = await limiter.consume({ user: 'u_a', org: 'o_a' });
    expect(r.allowed).toBe(false);
    if (r.allowed) throw new Error('unreachable');
    expect(r.tier).toBe('org');
    expect(r.retryAfterMs).toBe(10_000);
  });
});

describe('consume — anonymous (AC #8)', () => {
  it('throws when neither user nor apiKey is supplied', async () => {
    const { limiter } = makeLimiter();
    await expect(limiter.consume({ org: 'o_a' })).rejects.toThrow(
      /at least one of user or apiKey required/,
    );
  });

  it('does not throw when only user is supplied', async () => {
    const { limiter } = makeLimiter();
    const r = await limiter.consume({ user: 'u_only' });
    expect(r.allowed).toBe(true);
  });

  it('does not throw when only apiKey is supplied', async () => {
    const { limiter } = makeLimiter();
    const r = await limiter.consume({ apiKey: 'k_only' });
    expect(r.allowed).toBe(true);
  });
});

describe('consume — per-key isolation (AC #9)', () => {
  it('does not affect a different user’s bucket', async () => {
    const now = 0;
    const { limiter } = makeLimiter({ now: () => now });
    // Drain u_a (capacity 2)
    await limiter.consume({ user: 'u_a' });
    await limiter.consume({ user: 'u_a' });
    const blocked = await limiter.consume({ user: 'u_a' });
    expect(blocked.allowed).toBe(false);
    // u_b is untouched
    const fresh = await limiter.consume({ user: 'u_b' });
    expect(fresh.allowed).toBe(true);
  });
});

describe('consume — org bucket shared (AC #10)', () => {
  it('two different users in the same org draw from the same org bucket', async () => {
    const now = 0;
    const redis = new InMemoryRedis();
    const limiter = new RateLimiter({
      redis,
      now: () => now,
      config: {
        // org capacity 2; user capacity 5 so org runs out first.
        user: { capacity: 5, refillPerSecond: 1 },
        org: { capacity: 2, refillPerSecond: 0.5 },
        apiKey: { capacity: 5, refillPerSecond: 1 },
      },
    });
    const r1 = await limiter.consume({ user: 'u_a', org: 'shared' });
    const r2 = await limiter.consume({ user: 'u_b', org: 'shared' });
    const r3 = await limiter.consume({ user: 'u_c', org: 'shared' });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    if (r3.allowed) throw new Error('unreachable');
    expect(r3.tier).toBe('org');
  });
});

describe('redis key namespace (D-T263-2)', () => {
  it('uses ratelimit:{tier}:{id} format by default', async () => {
    const { limiter, redis } = makeLimiter();
    await limiter.consume({ user: 'u_x', org: 'o_x', apiKey: 'k_x' });
    const keys = Array.from(redis.snapshot().keys()).sort();
    expect(keys).toEqual(['ratelimit:apiKey:k_x', 'ratelimit:org:o_x', 'ratelimit:user:u_x']);
  });

  it('honours custom namespace', async () => {
    const redis = new InMemoryRedis();
    const limiter = new RateLimiter({ redis, namespace: 'rl-test' });
    await limiter.consume({ user: 'u_x' });
    expect(Array.from(redis.snapshot().keys())).toEqual(['rl-test:user:u_x']);
  });
});

describe('redis key TTL', () => {
  let now = 0;
  beforeEach(() => {
    now = 0;
  });
  it('writes a TTL of 2× full refill period', async () => {
    const redis = new InMemoryRedis(() => now);
    const limiter = new RateLimiter({
      redis,
      now: () => now,
      config: {
        user: { capacity: 10, refillPerSecond: 1 },
        org: { capacity: 600, refillPerSecond: 10 },
        apiKey: { capacity: 300, refillPerSecond: 5 },
      },
    });
    await limiter.consume({ user: 'u_a' });
    // user full-refill = 10s → TTL 20s. After 19s the key still exists.
    now = 19_000;
    expect(await redis.get('ratelimit:user:u_a')).not.toBeNull();
    // After 21s it has expired.
    now = 21_000;
    expect(await redis.get('ratelimit:user:u_a')).toBeNull();
  });
});
