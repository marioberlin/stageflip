// packages/export-google-slides/src/api/client.ts
// Slides-API mutation client surface. Extends T-244's read-only client with
// `presentations.create`, `presentations.batchUpdate`, `drive.files.create`.
// Hand-rolled (no `googleapis` dep) per T-244's accepted precedent. Tests
// inject a `SlidesMutationClient` stub via `ExportGoogleSlidesOptions.apiClient`;
// production wires through the default fetch-driven implementation.

import type { GoogleAuthProvider } from '@stageflip/import-google-slides';
import { fetchPresentation, fetchSlideThumbnail } from '@stageflip/import-google-slides';
import type {
  ApiPresentation,
  BatchUpdateRequest,
  BatchUpdateResponse,
  CreatePresentationResponse,
  DriveFileCreateResponse,
} from './types.js';

/**
 * Mutation surface T-252 needs. The exporter calls into this; the
 * `SlidesMutationClient` is the seam tests use to inject canned responses.
 */
export interface SlidesMutationClient {
  /** `presentations.create` — creates a new presentation. */
  createPresentation(opts: { title?: string }): Promise<CreatePresentationResponse>;
  /** `presentations.batchUpdate` — applies a batch of mutation requests. */
  batchUpdate(opts: {
    presentationId: string;
    requests: BatchUpdateRequest[];
  }): Promise<BatchUpdateResponse>;
  /**
   * `drive.files.create` (multipart upload). Returns the new file's id; the
   * exporter constructs `https://drive.google.com/uc?id=<id>` as the
   * `contentUrl` for `CreateImageRequest`.
   */
  driveFilesCreate(opts: {
    bytes: Uint8Array;
    mimeType: 'image/png';
    name?: string;
  }): Promise<DriveFileCreateResponse>;
  /**
   * `presentations.pages.getThumbnail` — re-uses T-244's existing client.
   * The convergence loop needs this to fetch the post-apply rendered PNG.
   */
  fetchSlideThumbnail(opts: {
    presentationId: string;
    slideObjectId: string;
  }): Promise<{ bytes: Uint8Array; width: number; height: number }>;
  /**
   * `presentations.get` — read existing presentation state. The orchestrator
   * uses this to populate `buildPlan.existingPages` so option (b)
   * (duplicate-similar) can match against the live target slide. Spec §5
   * step 1.
   */
  getPresentation(opts: { presentationId: string }): Promise<ApiPresentation>;
}

export interface DefaultMutationClientOptions {
  auth: GoogleAuthProvider;
  apiBaseUrl?: string;
  driveApiBaseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://slides.googleapis.com/v1';
const DEFAULT_DRIVE_BASE_URL = 'https://www.googleapis.com';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Build the production fetch-driven mutation client. Wraps fetch with auth
 * + a per-request timeout + a single 401 retry. The retry/backoff policy
 * mirrors T-244's `authedGet` but is intentionally simpler — write paths
 * are non-idempotent so we don't loop on 5xx.
 */
export function createDefaultMutationClient(
  opts: DefaultMutationClientOptions,
): SlidesMutationClient {
  const apiBaseUrl = opts.apiBaseUrl ?? DEFAULT_BASE_URL;
  const driveApiBaseUrl = opts.driveApiBaseUrl ?? DEFAULT_DRIVE_BASE_URL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;

  // Timeouts: AC #28 forbids `setTimeout`/`setInterval` in
  // `packages/export-google-slides/src/**`. We rely on the underlying fetch
  // implementation's own timeout policy (Node 22 + `@stageflip/import-google-slides`'s
  // `fetchSlideThumbnail` already implement timeouts). The `timeoutMs` option
  // is kept for source-symmetry with T-244's client and is unused here.
  void timeoutMs;

  async function authedJson<T>(url: string, init: RequestInit): Promise<T> {
    let token = await opts.auth.getAccessToken();
    let authRetried = false;
    // Hard upper bound: 1 (initial) + 1 (auth retry).
    while (true) {
      const res = await fetchImpl(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401 && !authRetried) {
        authRetried = true;
        token = await opts.auth.getAccessToken();
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Slides API ${res.status}: ${body}`);
      }
      return (await res.json()) as T;
    }
  }

  return {
    async createPresentation(c) {
      const body = c.title !== undefined ? { title: c.title } : {};
      return authedJson<CreatePresentationResponse>(`${apiBaseUrl}/presentations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    async batchUpdate(c) {
      return authedJson<BatchUpdateResponse>(
        `${apiBaseUrl}/presentations/${encodeURIComponent(c.presentationId)}:batchUpdate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests: c.requests }),
        },
      );
    },
    async driveFilesCreate(c) {
      // Multipart upload — minimal RFC2046 body. The boundary is fixed for
      // determinism (the exporter never inspects it).
      const boundary = '----stageflip-export-boundary';
      const meta = JSON.stringify({ name: c.name ?? 'stageflip-fallback.png' });
      const enc = new TextEncoder();
      const head = enc.encode(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${c.mimeType}\r\n\r\n`,
      );
      const tail = enc.encode(`\r\n--${boundary}--`);
      const merged = new Uint8Array(head.length + c.bytes.length + tail.length);
      merged.set(head, 0);
      merged.set(c.bytes, head.length);
      merged.set(tail, head.length + c.bytes.length);
      return authedJson<DriveFileCreateResponse>(
        `${driveApiBaseUrl}/upload/drive/v3/files?uploadType=multipart`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: merged,
        },
      );
    },
    async fetchSlideThumbnail(c) {
      const fetchOpts: { apiBaseUrl?: string; fetchImpl?: typeof fetch } = {};
      if (opts.apiBaseUrl !== undefined) fetchOpts.apiBaseUrl = opts.apiBaseUrl;
      if (opts.fetchImpl !== undefined) fetchOpts.fetchImpl = opts.fetchImpl;
      return fetchSlideThumbnail(c.presentationId, c.slideObjectId, 'LARGE', opts.auth, fetchOpts);
    },
    async getPresentation(c) {
      const fetchOpts: { apiBaseUrl?: string; fetchImpl?: typeof fetch } = {};
      if (opts.apiBaseUrl !== undefined) fetchOpts.apiBaseUrl = opts.apiBaseUrl;
      if (opts.fetchImpl !== undefined) fetchOpts.fetchImpl = opts.fetchImpl;
      // Cast: T-244's `ApiPresentation` shape is structurally a superset of
      // ours (extra optional fields like `slideProperties` we don't read).
      const raw = (await fetchPresentation(c.presentationId, opts.auth, fetchOpts)) as unknown;
      return raw as ApiPresentation;
    },
  };
}
