// packages/marketplace-registry/src/publishers/registry.test.ts
// T-536 — TOFU registry semantics.

import { describe, expect, it } from 'vitest';

import { InMemoryPublisherKeyRegistry } from './registry.js';

const PEM_A = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  '-----END PUBLIC KEY-----',
].join('\n');

const PEM_A_WITH_WHITESPACE = `\n  ${PEM_A}  \n\n`;

const PEM_B = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  '-----END PUBLIC KEY-----',
].join('\n');

describe('InMemoryPublisherKeyRegistry', () => {
  it('records on first publish (TOFU)', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    const res = await r.recordOrVerify('stageflip', PEM_A);
    expect(res.ok).toBe(true);
    expect(res.reason).toBeUndefined();
  });

  it('verifies on subsequent publish with matching key', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    await r.recordOrVerify('stageflip', PEM_A);
    const res = await r.recordOrVerify('stageflip', PEM_A);
    expect(res.ok).toBe(true);
  });

  it('rejects on key mismatch', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    await r.recordOrVerify('stageflip', PEM_A);
    const res = await r.recordOrVerify('stageflip', PEM_B);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('key-mismatch');
  });

  it('normalizes PEM whitespace and CRLF', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    await r.recordOrVerify('stageflip', PEM_A);
    const crlf = PEM_A.replace(/\n/g, '\r\n');
    const res = await r.recordOrVerify('stageflip', PEM_A_WITH_WHITESPACE);
    expect(res.ok).toBe(true);
    const res2 = await r.recordOrVerify('stageflip', crlf);
    expect(res2.ok).toBe(true);
  });

  it('getPublicKey returns the bound PEM', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    await r.recordOrVerify('stageflip', PEM_A);
    const got = await r.getPublicKey('stageflip');
    expect(got).toBe(PEM_A);
  });

  it('getPublicKey returns null for unknown publisher', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    expect(await r.getPublicKey('never-seen')).toBeNull();
  });

  it('isolates state per publisher', async () => {
    const r = new InMemoryPublisherKeyRegistry();
    await r.recordOrVerify('a', PEM_A);
    await r.recordOrVerify('b', PEM_B);
    expect(await r.getPublicKey('a')).toBe(PEM_A);
    expect(await r.getPublicKey('b')).toBe(PEM_B);
  });
});
