// packages/variant-gen/src/cache-key.test.ts
// Cache-key derivation tests (T-386 AC #19).

import { describe, expect, it } from 'vitest';
import { deriveCacheKey } from './cache-key.js';

describe('deriveCacheKey', () => {
  it('returns 64-hex-char sha256 strings', () => {
    const key = deriveCacheKey('doc-1', { messageId: 'm1', locale: 'en-US' });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different coordinates produce different keys', () => {
    const a = deriveCacheKey('doc-1', { messageId: 'm1', locale: 'en-US' });
    const b = deriveCacheKey('doc-1', { messageId: 'm2', locale: 'en-US' });
    const c = deriveCacheKey('doc-1', { messageId: 'm1', locale: 'de-DE' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('identical coordinates produce identical keys', () => {
    const a = deriveCacheKey('doc-1', { messageId: 'm1', locale: 'en-US' });
    const b = deriveCacheKey('doc-1', { messageId: 'm1', locale: 'en-US' });
    expect(a).toBe(b);
  });

  it('different source doc IDs produce different keys at the same coordinate', () => {
    const a = deriveCacheKey('doc-1', { messageId: 'm1' });
    const b = deriveCacheKey('doc-2', { messageId: 'm1' });
    expect(a).not.toBe(b);
  });

  it('matches the sha256 of "abc" — implementation vector pin', async () => {
    // Algorithm vector pin: sha256("abc") in hex.
    const expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    const { sha256Hex } = await import('./cache-key.js');
    expect(sha256Hex('abc')).toBe(expected);
  });

  it('matches the sha256 of the empty string — implementation vector pin', async () => {
    const expected = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const { sha256Hex } = await import('./cache-key.js');
    expect(sha256Hex('')).toBe(expected);
  });

  it('omitting messageId still yields a valid key', () => {
    const key = deriveCacheKey('doc-1', { locale: 'en-US' });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('omitting both axes still yields a valid key', () => {
    const key = deriveCacheKey('doc-1', {});
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
