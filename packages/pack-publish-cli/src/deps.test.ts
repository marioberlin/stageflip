// packages/pack-publish-cli/src/deps.test.ts
// T-500 — Tests for `createNodeDependencies`. Verifies the production
// wiring returns a full bundle, env reads from `process.env`, and
// http.post is a thin wrapper around `fetch`.

import { describe, expect, it, vi } from 'vitest';

import { createNodeDependencies } from './deps.js';

describe('createNodeDependencies', () => {
  it('returns a full bundle (fs + http + env + logger)', () => {
    const deps = createNodeDependencies();
    expect(typeof deps.fs.readFile).toBe('function');
    expect(typeof deps.fs.exists).toBe('function');
    expect(typeof deps.http.post).toBe('function');
    expect(typeof deps.env.get).toBe('function');
    expect(typeof deps.logger.info).toBe('function');
    expect(typeof deps.logger.warn).toBe('function');
    expect(typeof deps.logger.error).toBe('function');
  });

  it('env reads from process.env', () => {
    const key = '__PACK_PUBLISH_CLI_TEST_KEY__';
    process.env[key] = 'expected-value';
    try {
      const deps = createNodeDependencies();
      expect(deps.env.get(key)).toBe('expected-value');
      expect(deps.env.get(`${key}__unset__`)).toBeUndefined();
    } finally {
      delete process.env[key];
    }
  });

  it('http.post wraps global fetch and forwards method/headers/body', async () => {
    const originalFetch = globalThis.fetch;
    const fakeFetch = vi.fn(async () => ({
      status: 201,
      statusText: 'Created',
      text: async () => 'ok',
    }));
    globalThis.fetch = fakeFetch as unknown as typeof fetch;
    try {
      const deps = createNodeDependencies();
      const res = await deps.http.post(
        'https://example.com/api/v1/packs',
        { hello: 'world' },
        { authorization: 'Bearer x' },
      );
      expect(res.status).toBe(201);
      expect(res.statusText).toBe('Created');
      expect(res.bodyText).toBe('ok');
      expect(fakeFetch).toHaveBeenCalledTimes(1);
      const call = fakeFetch.mock.calls[0];
      expect(call?.[0]).toBe('https://example.com/api/v1/packs');
      const init = call?.[1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ hello: 'world' }));
      const headers = init.headers as Record<string, string>;
      expect(headers['content-type']).toBe('application/json');
      expect(headers.authorization).toBe('Bearer x');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('override?.fs replaces the production fs surface', () => {
    const stubFs = {
      readFile: vi.fn(async () => new Uint8Array()),
      readDir: vi.fn(async () => []),
      exists: vi.fn(async () => true),
      stat: vi.fn(async () => ({ isFile: () => true, isDirectory: () => false })),
    };
    const deps = createNodeDependencies({ fs: stubFs });
    expect(deps.fs).toBe(stubFs);
  });
});
