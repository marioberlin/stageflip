// packages/runtimes/interactive/src/clips/live-data/live-data-provider.test.ts
// T-391 ACs #9–#15 (provider seam contract) — `LiveDataProvider`,
// `HostFetcherProvider`, and `InMemoryLiveDataProvider` shape + behaviour.

import { describe, expect, it, vi } from 'vitest';

import {
  HostFetcherProvider,
  InMemoryLiveDataProvider,
  type Fetcher,
} from './live-data-provider.js';

describe('HostFetcherProvider', () => {
  it('forwards method, headers, and body to the host-injected fetcher', async () => {
    const fetcher: Fetcher = vi.fn(async () => ({
      status: 200,
      text: async () => 'hi',
      headers: { get: () => 'text/plain' },
    }));
    const provider = new HostFetcherProvider({ fetcher });
    await provider.fetchOnce({
      url: 'https://example.com/x',
      method: 'POST',
      headers: { 'X-Trace': 't' },
      body: '{"q":1}',
      signal: new AbortController().signal,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string | undefined },
    ];
    expect(url).toBe('https://example.com/x');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'X-Trace': 't' });
    expect(init.body).toBe('{"q":1}');
  });

  it('returns status, bodyText, and contentType from the host response', async () => {
    const fetcher: Fetcher = async () => ({
      status: 201,
      text: async () => 'created',
      headers: {
        get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
    });
    const provider = new HostFetcherProvider({ fetcher });
    const result = await provider.fetchOnce({
      url: 'https://x',
      method: 'GET',
      headers: {},
      body: undefined,
      signal: new AbortController().signal,
    });
    expect(result.status).toBe(201);
    expect(result.bodyText).toBe('created');
    expect(result.contentType).toBe('application/json');
  });

  it('returns contentType as undefined when the host omits the header', async () => {
    const fetcher: Fetcher = async () => ({
      status: 200,
      text: async () => '',
      headers: { get: () => null },
    });
    const provider = new HostFetcherProvider({ fetcher });
    const result = await provider.fetchOnce({
      url: 'https://x',
      method: 'GET',
      headers: {},
      body: undefined,
      signal: new AbortController().signal,
    });
    expect(result.contentType).toBeUndefined();
  });

  it('forwards the signal so an external abort propagates', async () => {
    const ctl = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const fetcher: Fetcher = async (_url, init) => {
      receivedSignal = init.signal;
      return { status: 200, text: async () => '', headers: { get: () => null } };
    };
    const provider = new HostFetcherProvider({ fetcher });
    await provider.fetchOnce({
      url: 'https://x',
      method: 'GET',
      headers: {},
      body: undefined,
      signal: ctl.signal,
    });
    expect(receivedSignal).toBe(ctl.signal);
  });
});

describe('InMemoryLiveDataProvider', () => {
  it('resolves a scripted response keyed by URL', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: {
        'https://example.com/users': {
          status: 200,
          bodyText: '{"name":"alice"}',
          contentType: 'application/json',
        },
      },
    });
    const result = await provider.fetchOnce({
      url: 'https://example.com/users',
      method: 'GET',
      headers: {},
      body: undefined,
      signal: new AbortController().signal,
    });
    expect(result.status).toBe(200);
    expect(result.bodyText).toBe('{"name":"alice"}');
    expect(result.contentType).toBe('application/json');
  });

  it('rejects with the configured error when the URL has rejectWith set', async () => {
    const err = new Error('network down');
    const provider = new InMemoryLiveDataProvider({
      scripted: { 'https://x': { rejectWith: err } },
    });
    await expect(
      provider.fetchOnce({
        url: 'https://x',
        method: 'GET',
        headers: {},
        body: undefined,
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(err);
  });

  it('rejects with NotFoundError when the URL has no scripted entry', async () => {
    const provider = new InMemoryLiveDataProvider({ scripted: {} });
    await expect(
      provider.fetchOnce({
        url: 'https://unscripted',
        method: 'GET',
        headers: {},
        body: undefined,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(/InMemoryLiveDataProvider/);
  });

  it('rejects immediately if signal is already aborted', async () => {
    const provider = new InMemoryLiveDataProvider({
      scripted: { 'https://x': { status: 200, bodyText: '' } },
    });
    const ctl = new AbortController();
    ctl.abort();
    await expect(
      provider.fetchOnce({
        url: 'https://x',
        method: 'GET',
        headers: {},
        body: undefined,
        signal: ctl.signal,
      }),
    ).rejects.toThrow(/Abort/);
  });
});
