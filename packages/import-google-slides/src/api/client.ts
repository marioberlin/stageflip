// packages/import-google-slides/src/api/client.ts
// Thin wrapper around `presentations.get` + `presentations.pages.getThumbnail`.
// Two-step thumbnail fetch (Slides API JSON returns a short-lived `contentUrl`,
// then a second GET — without auth header — fetches the PNG bytes). 401 → one
// retry after re-acquiring the token; 5xx → exponential backoff (250 / 500 /
// 1000 ms); per-request timeout configurable, default 30s. T-244 spec ACs #1-5.

import { GoogleApiError } from '../types.js';
import type { ApiPresentation, ApiThumbnail } from './types.js';

/** Auth provider contract — production wiring lives in `apps/api`. */
export interface GoogleAuthProvider {
  /** Returns a fresh OAuth access token with `presentations.readonly` scope. */
  getAccessToken(): Promise<string>;
}

export type ThumbnailSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface ApiClientOptions {
  /** Override the API base URL (for testing against a recorded-response server). */
  apiBaseUrl?: string;
  /** Per-request timeout in ms. Default 30s. */
  timeoutMs?: number;
  /** Override the global fetch (for tests). */
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://slides.googleapis.com/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const BACKOFF_MS = [250, 500, 1000] as const;

interface NormalizedOptions {
  apiBaseUrl: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

function normalize(opts: ApiClientOptions): NormalizedOptions {
  return {
    apiBaseUrl: opts.apiBaseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: opts.fetchImpl ?? fetch,
  };
}

/**
 * Wrap fetch with an AbortController-driven timeout. Throws GoogleApiError
 * with code='TIMEOUT' on timeout.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GoogleApiError({
        code: 'TIMEOUT',
        message: `request timed out after ${timeoutMs}ms`,
      });
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GoogleApiError({
        code: 'TIMEOUT',
        message: `request timed out after ${timeoutMs}ms`,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Issue an authenticated GET. Handles 401 retry (one re-acquire + retry),
 * 5xx backoff (3 attempts with 250/500/1000 ms delays), and timeout.
 * Caller passes the URL + an auth provider.
 */
async function authedGet(
  url: string,
  auth: GoogleAuthProvider,
  norm: NormalizedOptions,
): Promise<Response> {
  let token = await auth.getAccessToken();
  let attempt = 0;
  let authRetried = false;

  // Loop manages auth + 5xx retries. We never recurse — the retry counter is
  // explicit so test mock-fetches can verify the call sequence.
  // Hard upper bound: 1 (initial) + 1 (auth retry) + BACKOFF_MS.length (5xx).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      norm.timeoutMs,
      norm.fetchImpl,
    );
    if (res.status === 401) {
      if (authRetried) {
        throw new GoogleApiError({ code: 'AUTH_FAILED', httpStatus: 401 });
      }
      authRetried = true;
      token = await auth.getAccessToken();
      continue;
    }
    if (res.status >= 500 && res.status < 600) {
      if (attempt >= BACKOFF_MS.length) {
        throw new GoogleApiError({ code: 'API_UNAVAILABLE', httpStatus: res.status });
      }
      const delay = BACKOFF_MS[attempt] ?? 1000;
      attempt += 1;
      await sleep(delay);
      continue;
    }
    if (!res.ok) {
      throw new GoogleApiError({ code: 'BAD_RESPONSE', httpStatus: res.status });
    }
    return res;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch the full `Presentation` JSON. AC #1.
 */
export async function fetchPresentation(
  presentationId: string,
  auth: GoogleAuthProvider,
  opts: ApiClientOptions = {},
): Promise<ApiPresentation> {
  const norm = normalize(opts);
  const url = `${norm.apiBaseUrl}/presentations/${encodeURIComponent(presentationId)}`;
  const res = await authedGet(url, auth, norm);
  return (await res.json()) as ApiPresentation;
}

/**
 * Fetch the rendered PNG for one slide. Two-step:
 *  1. GET `…/pages/{slideObjectId}/thumbnail?thumbnailProperties.thumbnailSize=SIZE
 *     &thumbnailProperties.mimeType=PNG` with the OAuth bearer.
 *  2. GET the returned `contentUrl` WITHOUT the auth header — it's a
 *     short-lived public link.
 *
 * AC #2 pins the URL format and the two-step fetch.
 */
export async function fetchSlideThumbnail(
  presentationId: string,
  slideObjectId: string,
  thumbnailSize: ThumbnailSize,
  auth: GoogleAuthProvider,
  opts: ApiClientOptions = {},
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const norm = normalize(opts);
  const url = `${norm.apiBaseUrl}/presentations/${encodeURIComponent(presentationId)}/pages/${encodeURIComponent(slideObjectId)}/thumbnail?thumbnailProperties.thumbnailSize=${thumbnailSize}&thumbnailProperties.mimeType=PNG`;
  const jsonRes = await authedGet(url, auth, norm);
  const thumb = (await jsonRes.json()) as ApiThumbnail;
  if (!thumb.contentUrl || typeof thumb.width !== 'number' || typeof thumb.height !== 'number') {
    throw new GoogleApiError({
      code: 'BAD_RESPONSE',
      message: 'thumbnail response missing contentUrl/width/height',
    });
  }
  // Step 2: bare GET, no auth header. Short-lived public link.
  const bytesRes = await fetchWithTimeout(
    thumb.contentUrl,
    { method: 'GET' },
    norm.timeoutMs,
    norm.fetchImpl,
  );
  if (!bytesRes.ok) {
    throw new GoogleApiError({
      code: 'BAD_RESPONSE',
      httpStatus: bytesRes.status,
      message: 'thumbnail contentUrl fetch failed',
    });
  }
  const buf = await bytesRes.arrayBuffer();
  return { bytes: new Uint8Array(buf), width: thumb.width, height: thumb.height };
}
