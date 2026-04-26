// packages/import-google-slides/src/api/client.test.ts
// Pin AC #1-5: presentations.get URL + auth header, two-step thumbnail fetch
// (auth-then-bare), 401 retry semantics, 5xx exponential backoff, timeout.

import { describe, expect, it, vi } from 'vitest';
import { GoogleApiError } from '../types.js';
import { type GoogleAuthProvider, fetchPresentation, fetchSlideThumbnail } from './client.js';

const fakeAuth = (token = 'tok-1'): GoogleAuthProvider => ({
  getAccessToken: async () => token,
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function bytesResponse(bytes: Uint8Array, status = 200): Response {
  return new Response(bytes, { status });
}

describe('fetchPresentation', () => {
  it('AC #1: GETs presentations/{id} with Authorization: Bearer <token>', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: url.toString(), init });
      return jsonResponse({ presentationId: 'pres1' });
    });
    const result = await fetchPresentation('pres1', fakeAuth('tok-A'), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.presentationId).toBe('pres1');
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) throw new Error('expected one call');
    expect(call.url).toBe('https://slides.googleapis.com/v1/presentations/pres1');
    const headers = call.init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe('Bearer tok-A');
  });

  it('uses the apiBaseUrl override and URL-encodes the id', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL) => {
      calls.push(url.toString());
      return jsonResponse({});
    });
    await fetchPresentation('with/slash', fakeAuth(), {
      apiBaseUrl: 'https://test.example/api',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(calls[0]).toBe('https://test.example/api/presentations/with%2Fslash');
  });
});

describe('fetchSlideThumbnail (two-step)', () => {
  it('AC #2: first GET returns contentUrl JSON; second GET fetches PNG bytes WITHOUT auth header', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const seq: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      seq.push({ url: url.toString(), init });
      if (seq.length === 1) {
        return jsonResponse({
          contentUrl: 'https://lh3.googleusercontent.com/short-lived/abc',
          width: 1600,
          height: 900,
        });
      }
      return bytesResponse(png);
    });
    const result = await fetchSlideThumbnail('presX', 'slide1', 'LARGE', fakeAuth('tok-A'), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.width).toBe(1600);
    expect(result.height).toBe(900);
    expect(Array.from(result.bytes)).toEqual([0x89, 0x50, 0x4e, 0x47]);

    expect(seq).toHaveLength(2);
    const [first, second] = seq;
    if (!first || !second) throw new Error('expected two calls');

    // First: documented thumbnail endpoint, with auth.
    expect(first.url).toBe(
      'https://slides.googleapis.com/v1/presentations/presX/pages/slide1/thumbnail?thumbnailProperties.thumbnailSize=LARGE&thumbnailProperties.mimeType=PNG',
    );
    expect((first.init?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Bearer tok-A',
    );

    // Second: contentUrl, NO auth header.
    expect(second.url).toBe('https://lh3.googleusercontent.com/short-lived/abc');
    expect(
      (second.init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBeUndefined();
  });

  it('throws BAD_RESPONSE when the JSON is missing contentUrl/width/height', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await expect(
      fetchSlideThumbnail('p', 's', 'LARGE', fakeAuth(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(GoogleApiError);
  });

  it('throws BAD_RESPONSE when the contentUrl GET returns non-2xx', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => {
      n += 1;
      if (n === 1) return jsonResponse({ contentUrl: 'https://x/y', width: 1600, height: 900 });
      return bytesResponse(new Uint8Array(), 404);
    });
    await expect(
      fetchSlideThumbnail('p', 's', 'LARGE', fakeAuth(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE', httpStatus: 404 });
  });
});

describe('auth retry (AC #3)', () => {
  it('on first 401, re-acquires token via getAccessToken and retries once; success → returns', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      n += 1;
      if (n === 1) return jsonResponse({}, 401);
      // verify second attempt used the refreshed token.
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.Authorization).toBe('Bearer tok-2');
      return jsonResponse({ presentationId: 'p' });
    });
    let calls = 0;
    const auth: GoogleAuthProvider = {
      getAccessToken: async () => {
        calls += 1;
        return calls === 1 ? 'tok-1' : 'tok-2';
      },
    };
    const result = await fetchPresentation('p', auth, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.presentationId).toBe('p');
    expect(calls).toBe(2);
    expect(n).toBe(2);
  });

  it('on second 401, throws GoogleApiError(AUTH_FAILED)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401));
    await expect(
      fetchPresentation('p', fakeAuth(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: 'AUTH_FAILED', httpStatus: 401 });
  });
});

describe('5xx exponential backoff (AC #4)', () => {
  it('retries 3 times with 250/500/1000 ms delays; on 4th 5xx throws API_UNAVAILABLE', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
      const promise = fetchPresentation('p', fakeAuth(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).catch((e: unknown) => e);
      // Drain all timers (sleep/backoff).
      await vi.runAllTimersAsync();
      const err = (await promise) as GoogleApiError;
      expect(err).toBeInstanceOf(GoogleApiError);
      expect(err.code).toBe('API_UNAVAILABLE');
      // Initial attempt + 3 retries = 4 fetch calls.
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('on 5xx then 200 → succeeds without throwing', async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      const fetchImpl = vi.fn(async () => {
        n += 1;
        if (n === 1) return jsonResponse({}, 500);
        return jsonResponse({ presentationId: 'p' });
      });
      const promise = fetchPresentation('p', fakeAuth(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.presentationId).toBe('p');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('timeout (AC #5)', () => {
  it('throws GoogleApiError(TIMEOUT) when the fetch exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url: string | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });
      const promise = fetchPresentation('p', fakeAuth(), {
        timeoutMs: 100,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(150);
      const err = (await promise) as GoogleApiError;
      expect(err).toBeInstanceOf(GoogleApiError);
      expect(err.code).toBe('TIMEOUT');
    } finally {
      vi.useRealTimers();
    }
  });
});
