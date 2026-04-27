// packages/presence/src/presence.test.ts
// AC #1–#3: colorForUserId purity, palette membership, Presence JSON round-trip.

import { describe, expect, it } from 'vitest';
import { PRESENCE_PALETTE, type Presence, colorForUserId } from './presence.js';

describe('colorForUserId', () => {
  // AC #1 — pinned fixture. The palette order is part of the API contract;
  // changing it shifts every user's color across releases.
  it('returns a stable color for a fixed userId (pinned)', () => {
    expect(colorForUserId('alice')).toBe('#3b82f6');
    expect(colorForUserId('bob')).toBe('#10b981');
  });

  it('is pure: same input → same output across calls', () => {
    const a = colorForUserId('user-42');
    const b = colorForUserId('user-42');
    expect(a).toBe(b);
  });

  // AC #2
  it('always returns one of the 12 palette colors', () => {
    for (const id of ['', 'a', 'longer-user-id', '🦊emoji-user', 'mario@example.com']) {
      expect(PRESENCE_PALETTE).toContain(colorForUserId(id));
    }
  });

  it('never returns empty string', () => {
    for (const id of ['', 'x', 'mario']) {
      expect(colorForUserId(id)).not.toBe('');
    }
  });
});

describe('Presence type', () => {
  // AC #3
  it('round-trips through JSON.stringify / JSON.parse with no field loss', () => {
    const p: Presence = {
      userId: 'alice',
      color: '#3b82f6',
      lastSeenMs: 1_700_000_000_000,
      cursor: { slideId: 'slide-1', x: 100, y: 200 },
      selection: { elementIds: ['el-a', 'el-b'] },
      status: 'active',
    };
    const restored = JSON.parse(JSON.stringify(p)) as Presence;
    expect(restored).toEqual(p);
  });

  it('omits optional fields cleanly', () => {
    const p: Presence = {
      userId: 'bob',
      color: '#10b981',
      lastSeenMs: 1_700_000_000_000,
    };
    const restored = JSON.parse(JSON.stringify(p)) as Presence;
    expect(restored).toEqual(p);
    expect('cursor' in restored).toBe(false);
    expect('selection' in restored).toBe(false);
    expect('status' in restored).toBe(false);
  });
});
