// packages/runtimes/interactive/src/clips/live-data/live-data-provider.ts
// `LiveDataProvider` interface + two implementations for T-391
// (D-T391-5):
//
//   1. `HostFetcherProvider` — wraps a host-supplied `Fetcher` callable
//      (typically `globalThis.fetch.bind(globalThis)`). The clip
//      directory NEVER references `globalThis.fetch` directly; the host
//      vetted egress at the network-permission gate (T-385) and is
//      responsible for any auth headers, CSP allowlisting, and tenant
//      scoping at request time.
//   2. `InMemoryLiveDataProvider` — resolves a scripted `Record<url,
//      ScriptedResponse>`. Used by the factory tests and by host
//      integration tests that don't want to stub a network globally.
//
// A `@stageflip/http-abstraction` package mirroring
// `@stageflip/llm-abstraction` is a future asset-gen task — Phase 14
// ADR-006 covers the pattern. T-391 ships only the seam.
//
// HARD-RULE COMPLIANCE (CLAUDE.md §3 + T-391 AC #26): this file
// contains NO direct `fetch(`, `XMLHttpRequest`, or `sendBeacon`
// reference. The `Fetcher` interface describes a callable shape that
// matches `globalThis.fetch` so a host can pass it through, but the
// resolution happens in host space, not here.
//
// BROWSER-SAFE — no Node-only imports.

/**
 * Arguments to {@link LiveDataProvider.fetchOnce}. The provider OWNS
 * the transport from invocation through to the returned tuple — the
 * factory awaits this resolution before resolving its own fetch
 * lifecycle.
 *
 * `signal` is the per-fetch AbortSignal: a `dispose()` while a fetch is
 * in flight aborts the underlying provider call (D-T391-7 + AC #16).
 */
export interface LiveDataFetchArgs {
  /** Absolute URL. The clip resolved this from `liveMount.props.endpoint`. */
  url: string;
  /** HTTP method. v1: `'GET' | 'POST'`. */
  method: 'GET' | 'POST';
  /**
   * Request headers. The factory adds `Content-Type: application/json`
   * for POST requests with a JSON body before invoking the provider;
   * the provider does not auto-merge headers.
   */
  headers: Record<string, string>;
  /**
   * Request body. `undefined` for GET, a stringified JSON payload for
   * POST. The factory stringifies — the provider does NOT.
   */
  body: string | undefined;
  /** Cancellation signal. Aborts the in-flight provider call. */
  signal: AbortSignal;
}

/**
 * Resolved response shape. The provider returns the raw body text and
 * status; the factory handles parsing per the clip's `parseMode`.
 */
export interface LiveDataFetchResult {
  /** HTTP status code. */
  status: number;
  /** Raw response body. Always a string. */
  bodyText: string;
  /**
   * Resolved `Content-Type` header value. `undefined` when the host
   * response does not include a `Content-Type` header.
   */
  contentType: string | undefined;
}

/**
 * The fetch seam. Two implementations ship with T-391; future tenant
 * adapters or cloud-only providers add a third.
 */
export interface LiveDataProvider {
  /**
   * Resolve a single endpoint fetch. Resolves with the response shape;
   * rejects on transport failure, abort, or any other error the
   * underlying transport surfaces.
   *
   * Rejections route via the factory's `live-data-clip.fetch.error`
   * telemetry. The factory does NOT classify the rejection itself —
   * the seam is responsible for surfacing a meaningful Error.
   */
  fetchOnce(args: LiveDataFetchArgs): Promise<LiveDataFetchResult>;
}

// ---------- Host fetcher provider — wraps a host-supplied callable ----------

/**
 * `Fetcher` shape — minimal subset of `globalThis.fetch` the
 * `HostFetcherProvider` consumes. Hosts pass either:
 *
 *   - `globalThis.fetch.bind(globalThis)` (production browser path)
 *   - A wrapped fetcher that adds tenant-scoped headers / auth
 *   - A test double
 *
 * The shape is structural — any callable matching this signature
 * works.
 */
export interface Fetcher {
  (
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body: string | undefined;
      signal: AbortSignal;
    },
  ): Promise<{
    status: number;
    text(): Promise<string>;
    headers: { get(key: string): string | null };
  }>;
}

/**
 * Construction options for {@link HostFetcherProvider}.
 */
export interface HostFetcherProviderOptions {
  /** Host-supplied `Fetcher` callable. Required. */
  fetcher: Fetcher;
}

/**
 * `LiveDataProvider` backed by a host-supplied `Fetcher`. The provider
 * does not apply any authorisation, CSP, or tenant logic — those are
 * the host's responsibility (ADR-005 §D7). The host's `Fetcher`
 * adapter is the seam where credential headers are injected at
 * request time.
 */
export class HostFetcherProvider implements LiveDataProvider {
  private readonly fetcher: Fetcher;

  constructor(options: HostFetcherProviderOptions) {
    this.fetcher = options.fetcher;
  }

  async fetchOnce(args: LiveDataFetchArgs): Promise<LiveDataFetchResult> {
    const response = await this.fetcher(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body,
      signal: args.signal,
    });
    const bodyText = await response.text();
    const contentType = response.headers.get('Content-Type') ?? undefined;
    return {
      status: response.status,
      bodyText,
      contentType,
    };
  }
}

// ---------- In-memory provider (tests) ----------

/**
 * One scripted response entry. EITHER `bodyText` (success path) OR
 * `rejectWith` (error path) — supplying both rejects the request.
 */
export interface ScriptedResponse {
  /** HTTP status code. Defaults to 200 if `bodyText` is supplied. */
  status?: number;
  /** Response body text. */
  bodyText?: string;
  /** Optional Content-Type. */
  contentType?: string;
  /** Optional pre-canned error to reject with. */
  rejectWith?: Error;
}

export interface InMemoryLiveDataProviderOptions {
  /**
   * Scripted responses keyed by URL. URLs not present in the script
   * cause `fetchOnce` to reject with a helpful error referencing this
   * provider.
   */
  scripted: Record<string, ScriptedResponse>;
}

/**
 * `LiveDataProvider` that resolves a script by URL. Used by the
 * factory tests; production code never instantiates this.
 *
 * Implementation note: an already-aborted signal at invocation time
 * rejects synchronously with an `AbortError`-named Error so the
 * factory's abort-discipline path surfaces the same shape it would
 * see from a real provider.
 */
export class InMemoryLiveDataProvider implements LiveDataProvider {
  private readonly scripted: Record<string, ScriptedResponse>;

  constructor(options: InMemoryLiveDataProviderOptions) {
    this.scripted = options.scripted;
  }

  fetchOnce(args: LiveDataFetchArgs): Promise<LiveDataFetchResult> {
    if (args.signal.aborted) {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      return Promise.reject(err);
    }
    const entry = this.scripted[args.url];
    if (entry === undefined) {
      return Promise.reject(
        new Error(
          `InMemoryLiveDataProvider: no scripted response for url '${args.url}'. Add an entry to options.scripted.`,
        ),
      );
    }
    if (entry.rejectWith !== undefined) {
      return Promise.reject(entry.rejectWith);
    }
    return Promise.resolve({
      status: entry.status ?? 200,
      bodyText: entry.bodyText ?? '',
      contentType: entry.contentType,
    });
  }
}
