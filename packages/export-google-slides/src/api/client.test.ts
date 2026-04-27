// packages/export-google-slides/src/api/client.test.ts
// Pins the default fetch-driven mutation client. Auth header injection,
// 401-retry, JSON shape passthrough.

import { describe, expect, it } from 'vitest';
import { createDefaultMutationClient } from './client.js';

describe('createDefaultMutationClient', () => {
  it('createPresentation: posts JSON with title, includes Authorization bearer', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ presentationId: 'created-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const client = createDefaultMutationClient({
      auth: {
        async getAccessToken() {
          return 'tok-A';
        },
      },
      fetchImpl,
    });
    const r = await client.createPresentation({ title: 'My Deck' });
    expect(r.presentationId).toBe('created-id');
    expect(calls).toHaveLength(1);
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-A');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ title: 'My Deck' });
  });

  it('batchUpdate: posts to :batchUpdate endpoint with requests body', async () => {
    let captured: { url: string; body: string } | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      captured = { url: String(url), body: String(init?.body) };
      return new Response(JSON.stringify({ presentationId: 'p1', replies: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const client = createDefaultMutationClient({
      auth: {
        async getAccessToken() {
          return 'tok-B';
        },
      },
      fetchImpl,
    });
    await client.batchUpdate({
      presentationId: 'p1',
      requests: [{ deleteObject: { objectId: 'x' } }],
    });
    expect(captured?.url).toMatch(/p1:batchUpdate$/);
    expect(JSON.parse(captured?.body ?? '')).toEqual({
      requests: [{ deleteObject: { objectId: 'x' } }],
    });
  });

  it('401 retry: re-acquires token once and re-issues', async () => {
    let attempt = 0;
    const tokens: string[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      tokens.push(headers.Authorization);
      attempt += 1;
      if (attempt === 1) return new Response('', { status: 401 });
      return new Response(JSON.stringify({ presentationId: 'p1', replies: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    let getCount = 0;
    const client = createDefaultMutationClient({
      auth: {
        async getAccessToken() {
          getCount += 1;
          return `tok-${getCount}`;
        },
      },
      fetchImpl,
    });
    await client.batchUpdate({ presentationId: 'p1', requests: [] });
    expect(attempt).toBe(2);
    expect(tokens).toEqual(['Bearer tok-1', 'Bearer tok-2']);
  });

  it('non-OK response throws an Error with the body', async () => {
    const fetchImpl: typeof fetch = async () => new Response('bad request', { status: 400 });
    const client = createDefaultMutationClient({
      auth: {
        async getAccessToken() {
          return 'tok';
        },
      },
      fetchImpl,
    });
    await expect(client.batchUpdate({ presentationId: 'p1', requests: [] })).rejects.toThrow(/400/);
  });

  it('driveFilesCreate: multipart upload with image/png + JSON metadata', async () => {
    let captured: { url: string; body: ArrayBuffer; contentType: string } | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = init?.body as Uint8Array;
      captured = {
        url: String(url),
        body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
        contentType: headers['Content-Type'] ?? '',
      };
      return new Response(JSON.stringify({ id: 'drive-id-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const client = createDefaultMutationClient({
      auth: {
        async getAccessToken() {
          return 'tok';
        },
      },
      fetchImpl,
    });
    const r = await client.driveFilesCreate({
      bytes: new Uint8Array([1, 2, 3, 4]),
      mimeType: 'image/png',
      name: 'x.png',
    });
    expect(r.id).toBe('drive-id-1');
    expect(captured?.url).toMatch(/uploadType=multipart/);
    expect(captured?.contentType).toMatch(/^multipart\/related; boundary=/);
  });
});
