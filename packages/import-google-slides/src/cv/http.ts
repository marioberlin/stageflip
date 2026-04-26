// packages/import-google-slides/src/cv/http.ts
// Production HttpCvProvider. POSTs the page image as multipart/form-data to
// `CV_WORKER_URL`; expects the same JSON shape as the stub. Retries on 5xx
// (3 attempts, 250/500/1000 ms backoff), times out at 60s. AC #10 / #11 / #12.

import { CvProviderError } from '../types.js';
import {
  type CvCandidateProvider,
  type CvCandidates,
  type CvDetectOptions,
  cvCandidatesSchema,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 60_000;
const BACKOFF_MS = [250, 500, 1000] as const;

export interface HttpCvProviderOptions {
  /** Worker base URL. Required. Defaults to `process.env.CV_WORKER_URL` if unset. */
  workerUrl?: string;
  /** Per-request timeout in ms. Default 60s. */
  timeoutMs?: number;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    if (err instanceof Error && err.name === 'AbortError') {
      throw new CvProviderError({
        code: 'TIMEOUT',
        message: `cv worker timed out after ${timeoutMs}ms`,
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class HttpCvProvider implements CvCandidateProvider {
  readonly #workerUrl: string;
  readonly #timeoutMs: number;
  readonly #fetchImpl: typeof fetch;

  constructor(opts: HttpCvProviderOptions = {}) {
    const url = opts.workerUrl ?? process.env.CV_WORKER_URL;
    if (!url) {
      throw new CvProviderError({
        code: 'WORKER_UNAVAILABLE',
        message: 'HttpCvProvider requires workerUrl or CV_WORKER_URL env var',
      });
    }
    this.#workerUrl = url;
    this.#timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#fetchImpl = opts.fetchImpl ?? fetch;
  }

  async detect(pageImage: Uint8Array, opts: CvDetectOptions): Promise<CvCandidates> {
    const form = new FormData();
    // Wrap bytes in a Blob so multipart boundaries land correctly. The CV
    // worker side reads `image` as the file part and `options` as the JSON
    // metadata part.
    const blob = new Blob([pageImage as BlobPart], { type: 'image/png' });
    form.append('image', blob, 'page.png');
    form.append(
      'options',
      JSON.stringify({ renderWidth: opts.renderWidth, renderHeight: opts.renderHeight }),
    );

    let attempt = 0;
    // Idempotent retries on 5xx; auth/4xx errors throw immediately.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await fetchWithTimeout(
        this.#workerUrl,
        { method: 'POST', body: form },
        this.#timeoutMs,
        this.#fetchImpl,
      );
      if (res.status >= 500 && res.status < 600) {
        if (attempt >= BACKOFF_MS.length) {
          throw new CvProviderError({
            code: 'WORKER_UNAVAILABLE',
            message: `cv worker returned ${res.status} after ${BACKOFF_MS.length} retries`,
          });
        }
        const delay = BACKOFF_MS[attempt] ?? 1000;
        attempt += 1;
        await sleep(delay);
        continue;
      }
      if (!res.ok) {
        throw new CvProviderError({
          code: 'BAD_RESPONSE',
          message: `cv worker returned non-2xx status ${res.status}`,
        });
      }
      const json: unknown = await res.json();
      const parsed = cvCandidatesSchema.safeParse(json);
      if (!parsed.success) {
        throw new CvProviderError({
          code: 'BAD_RESPONSE',
          message: `cv worker response failed validation: ${parsed.error.message}`,
        });
      }
      return parsed.data;
    }
  }
}
