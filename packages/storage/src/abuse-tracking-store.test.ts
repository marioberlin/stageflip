// packages/storage/src/abuse-tracking-store.test.ts
// T-458 — Contract tests for InMemoryAbuseTrackingStore. Mirrors the
// 3-adapter pattern of TenantSettingsStore (T-411a) +
// TenantCostTrackerStore (T-443) — the same surface will be re-asserted
// by the Firestore-backed adapter test file in T-474.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryAbuseTrackingStore } from './abuse-tracking-store.js';
import {
  ABUSE_COOLDOWN_MS,
  type AbuseSource,
  DEFAULT_ABUSE_THRESHOLD,
  DEFAULT_ABUSE_WINDOW_MS,
} from './abuse-tracking.js';

const VOTER: AbuseSource = { kind: 'voter-token', value: 'voter-1' };
const OTHER_VOTER: AbuseSource = { kind: 'voter-token', value: 'voter-2' };
const IP: AbuseSource = { kind: 'ip', value: '10.0.0.1' };

describe('InMemoryAbuseTrackingStore — defaults', () => {
  it('reports the configured window + threshold', () => {
    const store = new InMemoryAbuseTrackingStore();
    expect(store.windowMs).toBe(DEFAULT_ABUSE_WINDOW_MS);
    expect(store.threshold).toBe(DEFAULT_ABUSE_THRESHOLD);
  });

  it('honours a custom window + threshold', () => {
    const store = new InMemoryAbuseTrackingStore({ windowMs: 5_000, threshold: 3 });
    expect(store.windowMs).toBe(5_000);
    expect(store.threshold).toBe(3);
  });
});

describe('recordHit + getCounter — sliding window', () => {
  let t: number;
  let store: InMemoryAbuseTrackingStore;

  beforeEach(() => {
    t = 1_000_000;
    store = new InMemoryAbuseTrackingStore({ now: () => t, windowMs: 1_000, threshold: 5 });
  });

  afterEach(() => store.reset());

  it('returns hits=0 for an unseen source', async () => {
    expect(await store.getCounter(VOTER)).toEqual({ hits: 0, windowStart: t });
  });

  it('accumulates hits inside the window', async () => {
    await store.recordHit(VOTER);
    await store.recordHit(VOTER);
    await store.recordHit(VOTER);
    expect(await store.getCounter(VOTER)).toEqual({ hits: 3, windowStart: t });
  });

  it('prunes hits that fell out of the window', async () => {
    await store.recordHit(VOTER);
    t += 500;
    await store.recordHit(VOTER);
    t += 600; // first hit is now 1100ms old → outside the 1s window.
    expect((await store.getCounter(VOTER)).hits).toBe(1);
  });

  it('isolates voter-token from ip with the same string value', async () => {
    const tokenSrc: AbuseSource = { kind: 'voter-token', value: 'shared' };
    const ipSrc: AbuseSource = { kind: 'ip', value: 'shared' };
    await store.recordHit(tokenSrc);
    await store.recordHit(ipSrc);
    await store.recordHit(ipSrc);
    expect((await store.getCounter(tokenSrc)).hits).toBe(1);
    expect((await store.getCounter(ipSrc)).hits).toBe(2);
  });

  it('isolates per-source buckets', async () => {
    await store.recordHit(VOTER);
    await store.recordHit(VOTER);
    expect((await store.getCounter(VOTER)).hits).toBe(2);
    expect((await store.getCounter(OTHER_VOTER)).hits).toBe(0);
  });
});

describe('flag + getFlag — escalation', () => {
  let t: number;
  let store: InMemoryAbuseTrackingStore;

  beforeEach(() => {
    t = 1_000_000;
    store = new InMemoryAbuseTrackingStore({ now: () => t });
  });

  afterEach(() => store.reset());

  it('returns level 0 for an unseen source', async () => {
    expect(await store.getFlag(VOTER)).toEqual({ level: 0, expiresAt: 0 });
  });

  it('flags level 1 with a 30s cooldown', async () => {
    await store.flag(VOTER, 1);
    expect(await store.getFlag(VOTER)).toEqual({ level: 1, expiresAt: t + 30_000 });
  });

  it('flags level 2 with a 5min cooldown', async () => {
    await store.flag(VOTER, 2);
    expect(await store.getFlag(VOTER)).toEqual({ level: 2, expiresAt: t + 5 * 60_000 });
  });

  it('flags level 3 with a 1h cooldown', async () => {
    await store.flag(VOTER, 3);
    expect(await store.getFlag(VOTER)).toEqual({ level: 3, expiresAt: t + 60 * 60_000 });
  });

  it('clears with level 0', async () => {
    await store.flag(VOTER, 2);
    await store.flag(VOTER, 0);
    expect(await store.getFlag(VOTER)).toEqual({ level: 0, expiresAt: 0 });
  });

  it('lookup of cooldown table matches escalation steps', () => {
    expect(ABUSE_COOLDOWN_MS[1]).toBe(30_000);
    expect(ABUSE_COOLDOWN_MS[2]).toBe(5 * 60_000);
    expect(ABUSE_COOLDOWN_MS[3]).toBe(60 * 60_000);
  });

  it('does NOT auto-clear on read after expiresAt — caller compares', async () => {
    await store.flag(VOTER, 1);
    t += 60_000; // 60s later → flag's 30s cooldown elapsed.
    const flag = await store.getFlag(VOTER);
    expect(flag.level).toBe(1);
    expect(flag.expiresAt < t).toBe(true);
  });
});

describe('flag — preserves separately-recorded hits', () => {
  it('flagging a source does not zap its hit counter', async () => {
    let t = 1_000_000;
    const store = new InMemoryAbuseTrackingStore({
      now: () => t,
      windowMs: 60_000,
      threshold: 3,
    });
    await store.recordHit(VOTER);
    await store.recordHit(VOTER);
    await store.flag(VOTER, 1);
    t += 100;
    expect((await store.getCounter(VOTER)).hits).toBe(2);
    expect((await store.getFlag(VOTER)).level).toBe(1);
  });
});

describe('cleanup', () => {
  it('drops sources untouched before the cutoff', async () => {
    let t = 1_000_000;
    const store = new InMemoryAbuseTrackingStore({ now: () => t });
    await store.recordHit(VOTER);
    await store.recordHit(IP);
    t += 5_000;
    await store.recordHit(IP); // refresh IP's lastTouchedAt
    const removed = await store.cleanup(t - 100);
    expect(removed).toBe(1);
    expect((await store.getCounter(VOTER)).hits).toBe(0);
    // IP's hits remain.
    expect((await store.getCounter(IP)).hits).toBeGreaterThan(0);
  });

  it('returns 0 when nothing matches the cutoff', async () => {
    const store = new InMemoryAbuseTrackingStore({ now: () => 1_000 });
    await store.recordHit(VOTER);
    expect(await store.cleanup(0)).toBe(0);
  });
});
