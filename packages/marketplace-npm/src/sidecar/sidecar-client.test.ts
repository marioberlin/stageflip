// packages/marketplace-npm/src/sidecar/sidecar-client.test.ts

import { describe, expect, it, vi } from 'vitest';

import { createSidecarClient } from './sidecar-client.js';

function makeResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createSidecarClient', () => {
  it('throws on empty endpoint', () => {
    expect(() => createSidecarClient({ endpoint: '' })).toThrow(/non-empty string/);
  });

  it('happy path: 200 with active status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { ok: true, status: 'active' }));
    const client = createSidecarClient({
      endpoint: 'https://marketplace.stageflip.dev',
      fetch: fetchMock,
    });
    const r = await client.verify({ sku: 'sports', tenantToken: 'tnt' });
    expect(r).toEqual({ ok: true, status: 'active' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs).toBeDefined();
    if (!callArgs) throw new Error('unreachable');
    const [url, init] = callArgs;
    expect(url).toBe('https://marketplace.stageflip.dev/verify');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tnt');
  });

  it('strips trailing slashes from endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { ok: true, status: 'active' }));
    const client = createSidecarClient({
      endpoint: 'https://marketplace.stageflip.dev///',
      fetch: fetchMock,
    });
    await client.verify({ sku: 'sports', tenantToken: 'tnt' });
    const callArgs = fetchMock.mock.calls[0];
    if (!callArgs) throw new Error('unreachable');
    expect(callArgs[0]).toBe('https://marketplace.stageflip.dev/verify');
  });

  it('401 maps to { ok: false, status: revoked }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(401));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    const r = await client.verify({ sku: 'sku', tenantToken: 'tnt' });
    expect(r).toEqual({ ok: false, status: 'revoked' });
  });

  it('404 maps to { ok: false, status: pending }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(404));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    const r = await client.verify({ sku: 'unknown', tenantToken: 'tnt' });
    expect(r).toEqual({ ok: false, status: 'pending' });
  });

  it('5xx retries once then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200, { ok: true, status: 'active' }));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    const r = await client.verify({ sku: 'sku', tenantToken: 'tnt' });
    expect(r).toEqual({ ok: true, status: 'active' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('5xx retries once then still 5xx → throws', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(500));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    await expect(client.verify({ sku: 'sku', tenantToken: 'tnt' })).rejects.toThrow(/500 on retry/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('non-2xx / non-401 / non-404 throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(418));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    await expect(client.verify({ sku: 'sku', tenantToken: 'tnt' })).rejects.toThrow(
      /unexpected status 418/,
    );
  });

  it('malformed response body (missing ok) throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { status: 'active' }));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    await expect(client.verify({ sku: 'sku', tenantToken: 'tnt' })).rejects.toThrow(
      /body.ok is not a boolean/,
    );
  });

  it('malformed response body (invalid status) throws', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { ok: true, status: 'mystery' }));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    await expect(client.verify({ sku: 'sku', tenantToken: 'tnt' })).rejects.toThrow(
      /body.status is not one of/,
    );
  });

  it('network error surfaces wrapped error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('econn'));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    await expect(client.verify({ sku: 'sku', tenantToken: 'tnt' })).rejects.toThrow(
      /network error \(econn\)/,
    );
  });

  it('fetch shim is honored over globalThis.fetch', async () => {
    // If the shim is called, globalThis.fetch must NOT be.
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { ok: true, status: 'active' }));
    const client = createSidecarClient({ endpoint: 'https://m', fetch: fetchMock });
    await client.verify({ sku: 'sku', tenantToken: 'tnt' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
