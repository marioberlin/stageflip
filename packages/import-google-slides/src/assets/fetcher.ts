// packages/import-google-slides/src/assets/fetcher.ts
// `gslidesUrlFetcher`: fetch a short-lived image `contentUrl` returned by the
// Slides API. Like the thumbnail's contentUrl, image contentUrls are
// short-lived public links and do NOT take the OAuth token. Notes §4 spec.
//
// This shim is intentionally thin — `resolveAssets` (re-exported from
// @stageflip/import-pptx) accepts a fetcher callback; we provide one wired
// for plain HTTP GETs.

export interface GslidesUrlFetcherOptions {
  fetchImpl?: typeof fetch;
  /** Per-request timeout in ms. Default 30s. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Build a fetcher that, given a URL, returns its bytes. The URL is treated
 * as opaque — we do not add the OAuth header (the contentUrl is a public
 * short-lived link). Callers pass this to resolveAssets.
 */
export function gslidesUrlFetcher(
  opts: GslidesUrlFetcherOptions = {},
): (url: string) => Promise<Uint8Array> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async (url: string): Promise<Uint8Array> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
      if (!res.ok) {
        throw new Error(`gslidesUrlFetcher: ${url} returned status ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } finally {
      clearTimeout(timer);
    }
  };
}
