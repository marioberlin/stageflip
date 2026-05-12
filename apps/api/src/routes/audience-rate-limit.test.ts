// apps/api/src/routes/audience-rate-limit.test.ts
// T-453 / T-458 — Tests for `TokenBucketRateLimiter` +
// `TenantRateLimiter` + `VoterRateLimiter` + `IpJoinRateLimiter`.
// Asserts the token-bucket admits up to `2× ratePerSecond` burst and
// refuses further; bucket refills at the configured rate; per-key
// isolation. T-458 adds: abuse-cooldown short-circuits the bucket
// check; bucket-exhausted refusals contribute hits + escalate the
// flag level (30s → 5min → 1h); per-clip-kind voter-rate overrides
// (reaction-stream 10 Hz; default 2 Hz).

import { describe, expect, it } from 'vitest';

import { InMemoryAbuseTrackingStore } from '@stageflip/storage';

import {
  IpJoinRateLimiter,
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

  it('admits override rate when supplied', () => {
    const t = 1_000_000;
    const limiter = new TokenBucketRateLimiter({
      ratePerSecond: 2,
      burst: 4,
      now: () => t,
    });
    // Override admits up to override-burst (10) on the cold start.
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume('k', { ratePerSecond: 5, burst: 10 }).accepted).toBe(true);
    }
    expect(limiter.tryConsume('k', { ratePerSecond: 5, burst: 10 }).accepted).toBe(false);
  });
});

describe('TenantRateLimiter — ADR-009 §D3 burst=2× rate', () => {
  it('admits up to 2× maxIngestRateHz on the cold-burst, then refuses', async () => {
    const t = 1_000_000;
    const limiter = new TenantRateLimiter({ maxIngestRateHz: 5, now: () => t });
    // burst = 10
    for (let i = 0; i < 10; i++) {
      expect((await limiter.tryConsume('tenant-1')).accepted).toBe(true);
    }
    const denied = await limiter.tryConsume('tenant-1');
    expect(denied.accepted).toBe(false);
    expect(denied.rejectReason).toBe('rate-limited');
  });

  it('refills at maxIngestRateHz', async () => {
    let t = 1_000_000;
    const limiter = new TenantRateLimiter({ maxIngestRateHz: 100, now: () => t });
    // Drain the bucket (burst=200).
    for (let i = 0; i < 200; i++) await limiter.tryConsume('tenant-1');
    expect((await limiter.tryConsume('tenant-1')).accepted).toBe(false);
    // 10 ms later — refills by 100 * 0.01 = 1 token.
    t += 10;
    expect((await limiter.tryConsume('tenant-1')).accepted).toBe(true);
    expect((await limiter.tryConsume('tenant-1')).accepted).toBe(false);
  });
});

describe('VoterRateLimiter — default 2 Hz / 4 burst per ADR-009 §D3 line 231', () => {
  it('admits up to 4 on the cold burst, then refuses', async () => {
    const t = 1_000_000;
    const limiter = new VoterRateLimiter({ now: () => t });
    for (let i = 0; i < 4; i++) {
      expect((await limiter.tryConsume('voter-1')).accepted).toBe(true);
    }
    expect((await limiter.tryConsume('voter-1')).accepted).toBe(false);
  });

  it('isolates buckets per voter', async () => {
    const t = 1_000_000;
    const limiter = new VoterRateLimiter({ now: () => t });
    for (let i = 0; i < 4; i++) await limiter.tryConsume('voter-1');
    expect((await limiter.tryConsume('voter-1')).accepted).toBe(false);
    expect((await limiter.tryConsume('voter-2')).accepted).toBe(true);
  });

  it('reaction-stream override admits 10/s/voter — bursts up to 20', async () => {
    const t = 1_000_000;
    const limiter = new VoterRateLimiter({ now: () => t });
    limiter.setClipKindOverride('reaction-stream', 10);
    for (let i = 0; i < 20; i++) {
      expect((await limiter.tryConsume('voter-1', 'reaction-stream')).accepted).toBe(true);
    }
    expect((await limiter.tryConsume('voter-1', 'reaction-stream')).accepted).toBe(false);
  });

  it('non-overridden kinds remain at the default 2 Hz', async () => {
    const t = 1_000_000;
    const limiter = new VoterRateLimiter({ now: () => t });
    limiter.setClipKindOverride('reaction-stream', 10);
    for (let i = 0; i < 4; i++) {
      expect((await limiter.tryConsume('voter-1', 'live-poll-multiple-choice')).accepted).toBe(
        true,
      );
    }
    expect((await limiter.tryConsume('voter-1', 'live-poll-multiple-choice')).accepted).toBe(false);
  });

  it('rejects an override with a non-positive rate', () => {
    const limiter = new VoterRateLimiter();
    expect(() => limiter.setClipKindOverride('reaction-stream', 0)).toThrow();
  });
});

describe('VoterRateLimiter — abuse cooldown (T-458)', () => {
  it('refuses with abuse-cooldown when the source is flagged + within cooldown', async () => {
    const t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({ now: () => t });
    await abuseStore.flag({ kind: 'voter-token', value: 'voter-bad' }, 1);
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    const decision = await limiter.tryConsume('voter-bad');
    expect(decision.accepted).toBe(false);
    expect(decision.rejectReason).toBe('abuse-cooldown');
    expect(decision.flagLevel).toBe(1);
  });

  it('admits the request once the cooldown elapses', async () => {
    let t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({ now: () => t });
    await abuseStore.flag({ kind: 'voter-token', value: 'voter-cool' }, 1);
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    expect((await limiter.tryConsume('voter-cool')).rejectReason).toBe('abuse-cooldown');
    t += 31_000; // past the 30s cooldown.
    expect((await limiter.tryConsume('voter-cool')).accepted).toBe(true);
  });

  it('escalates to level 1 (30s) after threshold rate-limit refusals', async () => {
    const t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({
      now: () => t,
      threshold: 3,
    });
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    // Drain the bucket (burst=4).
    for (let i = 0; i < 4; i++) await limiter.tryConsume('spammer');
    // Three more refusals → flag.
    await limiter.tryConsume('spammer');
    await limiter.tryConsume('spammer');
    const third = await limiter.tryConsume('spammer');
    expect(third.flagLevel).toBe(1);
    const flag = await abuseStore.getFlag({ kind: 'voter-token', value: 'spammer' });
    expect(flag.level).toBe(1);
    expect(flag.expiresAt).toBe(t + 30_000);
  });

  it('escalates 1 → 2 (5min) when next flag falls within the escalation window', async () => {
    let t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({
      now: () => t,
      threshold: 1,
      windowMs: 1_000,
    });
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    // Drain bucket + cross threshold once → level 1.
    for (let i = 0; i < 4; i++) await limiter.tryConsume('escalator');
    const r1 = await limiter.tryConsume('escalator');
    expect(r1.flagLevel).toBe(1);
    // Wait past cooldown but well within the 1h escalation window.
    t += 60_000;
    // Drain again + cross threshold once → level 2.
    for (let i = 0; i < 4; i++) await limiter.tryConsume('escalator');
    const r2 = await limiter.tryConsume('escalator');
    expect(r2.flagLevel).toBe(2);
    expect((await abuseStore.getFlag({ kind: 'voter-token', value: 'escalator' })).expiresAt).toBe(
      t + 5 * 60_000,
    );
  });

  it('escalates 2 → 3 (1h) on third flag within the escalation window', async () => {
    let t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({
      now: () => t,
      threshold: 1,
      windowMs: 1_000,
    });
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    // L1
    for (let i = 0; i < 4; i++) await limiter.tryConsume('chronic');
    await limiter.tryConsume('chronic');
    t += 60_000;
    // L2
    for (let i = 0; i < 4; i++) await limiter.tryConsume('chronic');
    await limiter.tryConsume('chronic');
    t += 6 * 60_000; // past 5min cooldown but within 1h window.
    // L3
    for (let i = 0; i < 4; i++) await limiter.tryConsume('chronic');
    const r3 = await limiter.tryConsume('chronic');
    expect(r3.flagLevel).toBe(3);
    expect((await abuseStore.getFlag({ kind: 'voter-token', value: 'chronic' })).expiresAt).toBe(
      t + 60 * 60_000,
    );
  });

  it('drops back to level 1 when the source has been clear past the escalation window', async () => {
    let t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({
      now: () => t,
      threshold: 1,
      windowMs: 1_000,
    });
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    for (let i = 0; i < 4; i++) await limiter.tryConsume('reformed');
    await limiter.tryConsume('reformed'); // L1 flag, expires t+30s.
    // Wait past cooldown + past the 1h escalation window.
    t += 60_000 + 60 * 60_000 + 1_000;
    for (let i = 0; i < 4; i++) await limiter.tryConsume('reformed');
    const r = await limiter.tryConsume('reformed');
    expect(r.flagLevel).toBe(1); // back to level 1, not level 2.
  });

  it('caps escalation at level 3', async () => {
    let t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({ now: () => t, threshold: 1 });
    const limiter = new VoterRateLimiter({ now: () => t, abuseStore });
    for (const level of [1, 2, 3, 3] as const) {
      for (let i = 0; i < 4; i++) await limiter.tryConsume('persistent');
      const r = await limiter.tryConsume('persistent');
      expect(r.flagLevel).toBe(level);
      // Bump past previous cooldown but stay inside the escalation window.
      t += level === 1 ? 31_000 : level === 2 ? 6 * 60_000 : 60_000;
    }
  });
});

describe('TenantRateLimiter — abuse cooldown (T-458)', () => {
  it('refuses tenant request with abuse-cooldown when flagged', async () => {
    const t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({ now: () => t });
    await abuseStore.flag({ kind: 'voter-token', value: 'tenant:tenant-bad' }, 2);
    const limiter = new TenantRateLimiter({
      maxIngestRateHz: 100,
      now: () => t,
      abuseStore,
    });
    const decision = await limiter.tryConsume('tenant-bad');
    expect(decision.accepted).toBe(false);
    expect(decision.rejectReason).toBe('abuse-cooldown');
    expect(decision.flagLevel).toBe(2);
  });
});

describe('IpJoinRateLimiter — abuse cooldown (T-458)', () => {
  it('refuses join with abuse-cooldown when IP is flagged', async () => {
    const t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({ now: () => t });
    await abuseStore.flag({ kind: 'ip', value: '10.0.0.99' }, 1);
    const limiter = new IpJoinRateLimiter({ now: () => t, abuseStore });
    const decision = await limiter.tryConsume('10.0.0.99');
    expect(decision.accepted).toBe(false);
    expect(decision.rejectReason).toBe('abuse-cooldown');
    expect(decision.flagLevel).toBe(1);
  });

  it('admits up to the configured burst for unflagged IPs', async () => {
    const t = 1_000_000;
    const limiter = new IpJoinRateLimiter({ now: () => t, ratePerSecond: 5, burst: 10 });
    for (let i = 0; i < 10; i++) {
      expect((await limiter.tryConsume('10.0.0.1')).accepted).toBe(true);
    }
    expect((await limiter.tryConsume('10.0.0.1')).accepted).toBe(false);
  });

  it('escalates IP-axis flag on threshold crossing', async () => {
    const t = 1_000_000;
    const abuseStore = new InMemoryAbuseTrackingStore({ now: () => t, threshold: 2 });
    const limiter = new IpJoinRateLimiter({
      now: () => t,
      abuseStore,
      ratePerSecond: 1,
      burst: 1,
    });
    // First call admitted, then drained.
    expect((await limiter.tryConsume('10.0.0.5')).accepted).toBe(true);
    // Two refusals at threshold=2 → flag level 1.
    await limiter.tryConsume('10.0.0.5');
    const r = await limiter.tryConsume('10.0.0.5');
    expect(r.flagLevel).toBe(1);
  });
});
