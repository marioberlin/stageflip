// packages/marketplace-registry/src/auth/tokens.test.ts
// T-536 — Bearer-token validation + hashing semantics.

import { describe, expect, it } from 'vitest';

import { InMemoryTokenStore } from './tokens.js';

describe('InMemoryTokenStore', () => {
  it('hash() is deterministic and SHA-256-shaped (64-hex)', () => {
    const s = new InMemoryTokenStore();
    const h1 = s.hash('hello');
    const h2 = s.hash('hello');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(s.hash('different')).not.toBe(h1);
  });

  it('validate happy path returns publisherId', async () => {
    const s = new InMemoryTokenStore([{ token: 'plain-token-abc', publisherId: 'stageflip' }]);
    const r = await s.validate('plain-token-abc');
    expect(r.ok).toBe(true);
    expect(r.publisherId).toBe('stageflip');
  });

  it('validate rejects unknown token', async () => {
    const s = new InMemoryTokenStore([{ token: 'known', publisherId: 'stageflip' }]);
    const r = await s.validate('unknown');
    expect(r.ok).toBe(false);
    expect(r.publisherId).toBeUndefined();
  });

  it('validate rejects empty string', async () => {
    const s = new InMemoryTokenStore([{ token: '', publisherId: 'x' }]);
    // Even if a (silly) empty-token seed is provided, validate('') rejects
    // outright before the lookup.
    const r = await s.validate('');
    expect(r.ok).toBe(false);
  });

  it('never stores plaintext — internal map contains only hashes', () => {
    const s = new InMemoryTokenStore([
      { token: 'super-secret-token', publisherId: 'stageflip' },
      { token: 'another-secret', publisherId: 'other' },
    ]);
    const hashes = s._hashesForTestOnly();
    expect(hashes.length).toBe(2);
    for (const h of hashes) {
      expect(h).toMatch(/^[0-9a-f]{64}$/);
      expect(h).not.toContain('super');
      expect(h).not.toContain('secret');
      expect(h).not.toContain('another');
    }
  });

  it('hashes are stable across two stores with same input', () => {
    const a = new InMemoryTokenStore();
    const b = new InMemoryTokenStore();
    expect(a.hash('same')).toBe(b.hash('same'));
  });
});
