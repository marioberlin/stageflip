// packages/import-google-slides/src/cv/http.test.ts
// Pin AC #10 (multipart POST shape), #11 (5xx retry, 60s timeout), #12 (Zod
// validator throws on malformed responses).

import { describe, expect, it, vi } from 'vitest';
import { CvProviderError } from '../types.js';
import { HttpCvProvider } from './http.js';
import { StubCvProvider } from './stub.js';

const validResponse = {
  textLines: [],
  contours: [],
};

describe('HttpCvProvider POST shape (AC #10)', () => {
  it('POSTs multipart/form-data with `image` (PNG blob) + `options` JSON', async () => {
    const captured: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      captured.push({ url: url.toString(), init });
      return new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const provider = new HttpCvProvider({
      workerUrl: 'https://cv.example/detect',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await provider.detect(png, { renderWidth: 1600, renderHeight: 900 });

    expect(captured).toHaveLength(1);
    const call = captured[0];
    if (!call) throw new Error('expected one call');
    expect(call.url).toBe('https://cv.example/detect');
    expect(call.init?.method).toBe('POST');
    expect(call.init?.body).toBeInstanceOf(FormData);
    const form = call.init?.body as FormData;
    const image = form.get('image');
    const options = form.get('options');
    expect(image).toBeInstanceOf(Blob);
    expect(options).toBe('{"renderWidth":1600,"renderHeight":900}');
  });
});

describe('HttpCvProvider retries (AC #11)', () => {
  it('retries 3 times on 5xx with 250/500/1000 ms backoff; on 4th 5xx throws WORKER_UNAVAILABLE', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(async () => new Response('boom', { status: 503 }));
      const provider = new HttpCvProvider({
        workerUrl: 'https://cv.example/d',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const promise = provider
        .detect(new Uint8Array(), { renderWidth: 100, renderHeight: 100 })
        .catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      const err = (await promise) as CvProviderError;
      expect(err).toBeInstanceOf(CvProviderError);
      expect(err.code).toBe('WORKER_UNAVAILABLE');
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws TIMEOUT when fetch exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_u: string | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });
      const provider = new HttpCvProvider({
        workerUrl: 'https://cv.example/d',
        timeoutMs: 50,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const promise = provider
        .detect(new Uint8Array(), { renderWidth: 1, renderHeight: 1 })
        .catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(100);
      const err = (await promise) as CvProviderError;
      expect(err).toBeInstanceOf(CvProviderError);
      expect(err.code).toBe('TIMEOUT');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Zod validator at the provider boundary (AC #12)', () => {
  it('HttpCvProvider throws BAD_RESPONSE on response missing `confidence`', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            textLines: [{ polygonPx: [[0, 0]], text: 'x' /* missing confidence */ }],
            contours: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const provider = new HttpCvProvider({
      workerUrl: 'https://cv.example/d',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      provider.detect(new Uint8Array(), { renderWidth: 1, renderHeight: 1 }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('StubCvProvider rejects malformed fixtures at construction', () => {
    expect(
      () =>
        new StubCvProvider({
          'fixture-x': { textLines: [{ polygonPx: [[0, 0]], text: 'x' }], contours: [] },
        }),
    ).toThrow(CvProviderError);
  });

  it('StubCvProvider returns the fixture for the matching fixtureKey', async () => {
    const stub = new StubCvProvider({
      'fixture-1': validResponse,
    });
    const out = await stub.detect(new Uint8Array(), {
      renderWidth: 100,
      renderHeight: 100,
      fixtureKey: 'fixture-1',
    });
    expect(out).toEqual(validResponse);
  });

  it('StubCvProvider throws when fixtureKey is missing or unknown', async () => {
    const stub = new StubCvProvider({ a: validResponse });
    await expect(
      stub.detect(new Uint8Array(), { renderWidth: 1, renderHeight: 1 }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    await expect(
      stub.detect(new Uint8Array(), { renderWidth: 1, renderHeight: 1, fixtureKey: 'missing' }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('HttpCvProvider constructor throws when no workerUrl + env var empty', () => {
    const prevEnv = process.env.CV_WORKER_URL;
    process.env.CV_WORKER_URL = '';
    try {
      expect(() => new HttpCvProvider()).toThrow(CvProviderError);
    } finally {
      if (prevEnv !== undefined) process.env.CV_WORKER_URL = prevEnv;
      else process.env.CV_WORKER_URL = '';
    }
  });
});
