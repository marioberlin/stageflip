// packages/marketplace-npm/src/sidecar/sidecar-client.ts
// T-539 — Thin HTTP client for the marketplace's entitlement
// verification sidecar per ADR-014 §D2. The npm-based install path
// asks the marketplace "does this tenant token entitle sku X?"; the
// marketplace responds with `{ ok, status }`. The endpoint URL is
// supplied by the marketplace-registry (T-536) at npm-tooling
// onboarding time; this client only knows how to talk to it.
//
// Wire format (POST <endpoint>/verify):
//   request:  { sku: string, tenantToken: string }
//   response: { ok: boolean, status: 'active' | 'lapsed' | 'revoked' | 'pending' }
//
// Failure handling:
//   - 401 Unauthorized        → ok=false, status='revoked'  (server rejects token)
//   - 404 Not Found (sku)     → ok=false, status='pending'  (no entitlement row)
//   - 5xx                     → one retry; if still failing, throw
//   - malformed body          → throw
//
// Determinism perimeter: outside (CLI / host side).

/** Per-call verify input. */
export interface SidecarVerifyInput {
  readonly sku: string;
  readonly tenantToken: string;
}

/** Per-call verify result. */
export interface SidecarVerifyResult {
  readonly ok: boolean;
  readonly status: 'active' | 'lapsed' | 'revoked' | 'pending';
}

/** Sidecar HTTP-client surface. */
export interface SidecarClient {
  readonly verify: (opts: SidecarVerifyInput) => Promise<SidecarVerifyResult>;
}

/** Construction dependencies for `createSidecarClient`. */
export interface SidecarClientDeps {
  /** Base URL (no trailing slash) of the sidecar verification endpoint. */
  readonly endpoint: string;
  /**
   * Optional `fetch` shim — tests pass a mock. Production omits and
   * the call falls back to `globalThis.fetch` at request time.
   */
  readonly fetch?: typeof globalThis.fetch;
}

type FetchLike = typeof globalThis.fetch;

interface SidecarRawBody {
  readonly ok?: unknown;
  readonly status?: unknown;
}

const ALLOWED_STATUSES: readonly SidecarVerifyResult['status'][] = [
  'active',
  'lapsed',
  'revoked',
  'pending',
];

function parseBody(raw: unknown): SidecarVerifyResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('sidecar verify: response body is not an object');
  }
  const body = raw as SidecarRawBody;
  if (typeof body.ok !== 'boolean') {
    throw new Error('sidecar verify: response body.ok is not a boolean');
  }
  if (
    typeof body.status !== 'string' ||
    !ALLOWED_STATUSES.includes(body.status as SidecarVerifyResult['status'])
  ) {
    throw new Error(
      `sidecar verify: response body.status is not one of ${ALLOWED_STATUSES.join(', ')}`,
    );
  }
  return { ok: body.ok, status: body.status as SidecarVerifyResult['status'] };
}

async function doFetch(
  fetchImpl: FetchLike,
  endpoint: string,
  opts: SidecarVerifyInput,
): Promise<Response> {
  return fetchImpl(`${endpoint}/verify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${opts.tenantToken}`,
    },
    body: JSON.stringify({ sku: opts.sku, tenantToken: opts.tenantToken }),
  });
}

/**
 * Create a `SidecarClient` bound to `deps.endpoint`. The returned
 * `verify` method retries a single time on 5xx responses (per the
 * module header); other non-2xx responses map to the documented
 * status synonyms without throwing.
 */
export function createSidecarClient(deps: SidecarClientDeps): SidecarClient {
  if (typeof deps.endpoint !== 'string' || deps.endpoint.length === 0) {
    throw new Error('createSidecarClient: deps.endpoint must be a non-empty string');
  }
  const endpoint = deps.endpoint.replace(/\/+$/, '');
  const explicitFetch = deps.fetch;

  return {
    verify: async (opts: SidecarVerifyInput): Promise<SidecarVerifyResult> => {
      const fetchImpl: FetchLike = explicitFetch ?? globalThis.fetch;
      if (typeof fetchImpl !== 'function') {
        throw new Error('sidecar verify: no fetch implementation available');
      }

      let response: Response;
      try {
        response = await doFetch(fetchImpl, endpoint, opts);
      } catch (err) {
        throw new Error(`sidecar verify: network error (${(err as Error).message ?? 'unknown'})`);
      }

      // Retry once on 5xx.
      if (response.status >= 500 && response.status < 600) {
        try {
          response = await doFetch(fetchImpl, endpoint, opts);
        } catch (err) {
          throw new Error(
            `sidecar verify: network error on retry (${(err as Error).message ?? 'unknown'})`,
          );
        }
        if (response.status >= 500 && response.status < 600) {
          throw new Error(`sidecar verify: ${response.status} on retry`);
        }
      }

      if (response.status === 401) {
        return { ok: false, status: 'revoked' };
      }
      if (response.status === 404) {
        return { ok: false, status: 'pending' };
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`sidecar verify: unexpected status ${response.status}`);
      }

      const body = (await response.json()) as unknown;
      return parseBody(body);
    },
  };
}
