// packages/marketplace-npm/src/tokens/token-store.test.ts

import { describe, expect, it } from 'vitest';

import { InMemoryNpmTokenStore, assertValidScope, assertValidToken } from './token-store.js';

describe('InMemoryNpmTokenStore', () => {
  it('store + lookup roundtrip returns the stored token', async () => {
    const s = new InMemoryNpmTokenStore();
    await s.store('@stageflip-private', 'npm_abc123');
    expect(await s.lookup('@stageflip-private')).toBe('npm_abc123');
  });

  it('lookup returns null for unknown scopes', async () => {
    const s = new InMemoryNpmTokenStore();
    expect(await s.lookup('@nobody')).toBeNull();
  });

  it('store twice for the same scope overwrites the prior token', async () => {
    const s = new InMemoryNpmTokenStore();
    await s.store('@stageflip', 'first');
    await s.store('@stageflip', 'second');
    expect(await s.lookup('@stageflip')).toBe('second');
  });

  it('revoke removes the binding (subsequent lookup is null)', async () => {
    const s = new InMemoryNpmTokenStore();
    await s.store('@stageflip', 'tok');
    await s.revoke('@stageflip');
    expect(await s.lookup('@stageflip')).toBeNull();
  });

  it('revoke is a no-op when the scope is absent', async () => {
    const s = new InMemoryNpmTokenStore();
    await expect(s.revoke('@nobody')).resolves.toBeUndefined();
  });

  it('listScopes returns all bound scopes in insertion order', async () => {
    const s = new InMemoryNpmTokenStore();
    await s.store('@a', 't1');
    await s.store('@b', 't2');
    await s.store('@c', 't3');
    expect(await s.listScopes()).toEqual(['@a', '@b', '@c']);
  });

  it('listScopes reflects revoke', async () => {
    const s = new InMemoryNpmTokenStore();
    await s.store('@a', 't1');
    await s.store('@b', 't2');
    await s.revoke('@a');
    expect(await s.listScopes()).toEqual(['@b']);
  });

  it('rejects malformed scopes (missing @ prefix)', async () => {
    const s = new InMemoryNpmTokenStore();
    await expect(s.store('stageflip', 'tok')).rejects.toThrow(/invalid npm scope/);
  });

  it('rejects empty / non-string tokens', async () => {
    const s = new InMemoryNpmTokenStore();
    await expect(s.store('@stageflip', '')).rejects.toThrow(/non-empty string/);
  });
});

describe('assertValidScope', () => {
  it('accepts a well-formed scope', () => {
    expect(() => assertValidScope('@stageflip')).not.toThrow();
  });

  it('rejects empty / @-only / missing-prefix inputs', () => {
    expect(() => assertValidScope('')).toThrow();
    expect(() => assertValidScope('@')).toThrow();
    expect(() => assertValidScope('stageflip')).toThrow();
  });
});

describe('assertValidToken', () => {
  it('accepts a non-empty string', () => {
    expect(() => assertValidToken('npm_abc')).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => assertValidToken('')).toThrow();
  });
});
