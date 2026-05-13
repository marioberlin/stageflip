// packages/marketplace-stripe/src/webhooks/idempotency.test.ts
// T-537 — InMemoryIdempotencyStore dedup semantics.

import { describe, expect, it } from 'vitest';

import { InMemoryIdempotencyStore } from './idempotency.js';

describe('InMemoryIdempotencyStore', () => {
  it('seen() returns false before markSeen, true after', async () => {
    const s = new InMemoryIdempotencyStore();
    expect(await s.seen('evt_1')).toBe(false);
    await s.markSeen('evt_1');
    expect(await s.seen('evt_1')).toBe(true);
  });

  it('markSeen() is idempotent (calling twice is a no-op)', async () => {
    const s = new InMemoryIdempotencyStore();
    await s.markSeen('evt_dup');
    await s.markSeen('evt_dup');
    expect(s._sizeForTestOnly()).toBe(1);
    expect(await s.seen('evt_dup')).toBe(true);
  });

  it('distinct event ids are tracked independently', async () => {
    const s = new InMemoryIdempotencyStore();
    await s.markSeen('evt_a');
    await s.markSeen('evt_b');
    expect(await s.seen('evt_a')).toBe(true);
    expect(await s.seen('evt_b')).toBe(true);
    expect(await s.seen('evt_c')).toBe(false);
    expect(s._sizeForTestOnly()).toBe(2);
  });

  it('rejects empty / non-string event ids (no-op without error)', async () => {
    const s = new InMemoryIdempotencyStore();
    await s.markSeen('');
    expect(s._sizeForTestOnly()).toBe(0);
    expect(await s.seen('')).toBe(false);
  });
});
