// packages/audience-join-shared/src/room-code.test.ts
// T-456 — `roomCodeFor(sessionId)` deterministic 6-char room-code helper.
// Verifies determinism, alphabet conformance, distribution, async API.

import { describe, expect, it } from 'vitest';

import { roomCodeForSync } from './room-code-node.js';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isRoomCode, roomCodeFor } from './room-code.js';

describe('ROOM_CODE_ALPHABET', () => {
  it('is the 32-char Crockford-style alphabet excluding I/O/0/1', () => {
    expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it('uses 6 characters', () => {
    expect(ROOM_CODE_LENGTH).toBe(6);
  });
});

describe('roomCodeFor (async)', () => {
  it('returns a 6-character code over the alphabet', async () => {
    const code = await roomCodeFor('session-foo');
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const ch of code) {
      expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });

  it('is deterministic — same input → same output', async () => {
    const a = await roomCodeFor('01JD2P3Q');
    const b = await roomCodeFor('01JD2P3Q');
    expect(a).toBe(b);
  });

  it('produces different codes for different sessionIds', async () => {
    const a = await roomCodeFor('alpha');
    const b = await roomCodeFor('beta');
    expect(a).not.toBe(b);
  });

  it('matches the sync (node:crypto-backed) implementation', async () => {
    const sessionId = 'consistency-check';
    const fromAsync = await roomCodeFor(sessionId);
    const fromSync = roomCodeForSync(sessionId);
    expect(fromAsync).toBe(fromSync);
  });

  it('rejects empty sessionId', async () => {
    await expect(roomCodeFor('')).rejects.toThrow(/sessionId/);
  });

  it('produces fewer than 10 collisions across 100k synthetic UUIDs', () => {
    const seen = new Map<string, number>();
    const N = 100_000;
    for (let i = 0; i < N; i += 1) {
      // Use the sync codepath for speed; same algorithm as the async one.
      const code = roomCodeForSync(`uuid-${i}`);
      seen.set(code, (seen.get(code) ?? 0) + 1);
    }
    let collisions = 0;
    for (const [, count] of seen) {
      if (count > 1) collisions += count - 1;
    }
    // 30-bit space, 100k samples → expected ≈ 100000^2 / (2 * 2^30) ≈ 4.66
    // collisions. Threshold 10 leaves headroom but catches a real
    // distribution regression.
    expect(collisions).toBeLessThan(10);
  });
});

describe('roomCodeForSync', () => {
  it('returns a 6-character code over the alphabet', () => {
    const code = roomCodeForSync('hello');
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const ch of code) {
      expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });

  it('is deterministic', () => {
    expect(roomCodeForSync('x')).toBe(roomCodeForSync('x'));
  });

  it('rejects empty sessionId', () => {
    expect(() => roomCodeForSync('')).toThrow(/sessionId/);
  });
});

describe('isRoomCode', () => {
  it('accepts a code from roomCodeForSync', () => {
    expect(isRoomCode(roomCodeForSync('s'))).toBe(true);
  });
  it('rejects wrong length', () => {
    expect(isRoomCode('ABCDE')).toBe(false);
    expect(isRoomCode('ABCDEFG')).toBe(false);
  });
  it('rejects out-of-alphabet chars', () => {
    expect(isRoomCode('ABCDE0')).toBe(false);
    expect(isRoomCode('ABCDE1')).toBe(false);
    expect(isRoomCode('ABCDEI')).toBe(false);
    expect(isRoomCode('ABCDEO')).toBe(false);
  });
  it('rejects lowercase', () => {
    expect(isRoomCode('abcdef')).toBe(false);
  });
});
