// packages/auth-middleware/src/api-key-verify.test.ts
// T-262 AC #12–#13 — bcrypt-style hash + cache + revoke invalidation.
// We use scrypt rather than bcrypt (D-T262-2 implementer choice;
// see api-key-verify.ts header). The cache contract from the spec
// applies verbatim: keyed by plaintext, 60s TTL, manual invalidation.

import { afterEach, describe, expect, it } from 'vitest';
import {
  API_KEY_CACHE_TTL_MS,
  _resetApiKeyCacheForTest,
  compareApiKey,
  hashApiKey,
  invalidateApiKeyCache,
  readApiKeyCache,
  writeApiKeyCache,
} from './api-key-verify.js';

afterEach(() => {
  _resetApiKeyCacheForTest();
});

describe('hashApiKey + compareApiKey', () => {
  it('round-trips a plaintext through hash → compare = true', async () => {
    const stored = await hashApiKey('sf_dev_secret');
    expect(await compareApiKey('sf_dev_secret', stored)).toBe(true);
  });

  it('rejects a different plaintext', async () => {
    const stored = await hashApiKey('sf_dev_secret');
    expect(await compareApiKey('sf_dev_other', stored)).toBe(false);
  });

  it('rejects a malformed stored hash', async () => {
    expect(await compareApiKey('x', 'not-formatted')).toBe(false);
    expect(await compareApiKey('x', 'scrypt$$')).toBe(false);
  });
});

describe('api-key cache (AC #12)', () => {
  it('returns cached value within TTL', () => {
    const clock = { current: 1_000_000 };
    const tick = { now: () => clock.current };
    writeApiKeyCache('sf_dev_x', { orgId: 'o', keyId: 'k', role: 'editor' }, tick);
    expect(readApiKeyCache('sf_dev_x', tick)).toEqual({ orgId: 'o', keyId: 'k', role: 'editor' });
  });

  it('expires after TTL', () => {
    const clock = { current: 1_000_000 };
    const tick = { now: () => clock.current };
    writeApiKeyCache('sf_dev_x', { orgId: 'o', keyId: 'k', role: 'editor' }, tick);
    clock.current += API_KEY_CACHE_TTL_MS + 1;
    expect(readApiKeyCache('sf_dev_x', tick)).toBeUndefined();
  });

  it('cached read is sub-millisecond, scrypt compare is much slower (AC #12)', async () => {
    const stored = await hashApiKey('sf_dev_secret');
    const t0 = process.hrtime.bigint();
    await compareApiKey('sf_dev_secret', stored);
    const compareNs = Number(process.hrtime.bigint() - t0);
    // scrypt N=16384 reliably takes >>1ms; assert it's at least 1ms to
    // avoid flakiness on absurdly fast hardware.
    expect(compareNs).toBeGreaterThan(1_000_000);

    writeApiKeyCache('sf_dev_secret', { orgId: 'o', keyId: 'k', role: 'editor' });
    const t1 = process.hrtime.bigint();
    readApiKeyCache('sf_dev_secret');
    const cacheNs = Number(process.hrtime.bigint() - t1);
    // Cache lookup is a Map.get + Date.now; <100us in practice. Assert
    // at least 100x faster than the slow path to give comfortable
    // margin.
    expect(cacheNs).toBeLessThan(compareNs / 100);
  });
});

describe('invalidateApiKeyCache (AC #13)', () => {
  it('flushes a single key', () => {
    writeApiKeyCache('sf_dev_x', { orgId: 'o', keyId: 'k', role: 'editor' });
    invalidateApiKeyCache('sf_dev_x');
    expect(readApiKeyCache('sf_dev_x')).toBeUndefined();
  });

  it('does not affect other keys', () => {
    writeApiKeyCache('sf_dev_a', { orgId: 'o', keyId: 'a', role: 'editor' });
    writeApiKeyCache('sf_dev_b', { orgId: 'o', keyId: 'b', role: 'admin' });
    invalidateApiKeyCache('sf_dev_a');
    expect(readApiKeyCache('sf_dev_b')).toEqual({ orgId: 'o', keyId: 'b', role: 'admin' });
  });
});
