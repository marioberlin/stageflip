// packages/marketplace-registry/src/routes/types.ts
// T-536 — Express-like request / response shapes the registry handlers
// consume + a `RegistryDeps` bundle injected into each route. Plain
// types — no framework dependency; the production deployment wires
// these into Cloud-Run-compatible Express middleware in T-550.
//
// Determinism perimeter: outside (server-side).

import type { TokenStore } from '../auth/tokens.js';
import type { PublisherKeyRegistry } from '../publishers/registry.js';
import type { StorageAdapter } from '../storage/storage.js';

/**
 * Minimal request shape — the subset of an Express `Request` the
 * registry routes need. The orchestrating server-of-record adapter
 * (T-550) translates between this shape + its native request shape.
 */
export interface RouteRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: Uint8Array | string | undefined;
  readonly query: Record<string, string>;
}

/** Minimal response shape paired with `RouteRequest`. */
export interface RouteResponse {
  readonly status: number;
  readonly headers?: Record<string, string>;
  readonly body?: string | Uint8Array;
}

/** Per-route handler signature. */
export type RouteHandler = (req: RouteRequest) => Promise<RouteResponse>;

/**
 * Bundle of every server-side dependency the routes need. Passed to
 * `composeHandler` once at server boot — each request reuses the
 * same instances.
 */
export interface RegistryDeps {
  readonly storage: StorageAdapter;
  readonly publishers: PublisherKeyRegistry;
  readonly tokens: TokenStore;
}

/**
 * Helper: extract a bearer token from the `Authorization` header.
 * Returns `null` if the header is missing or not of the form
 * `Bearer <token>`.
 */
export function extractBearer(headers: Record<string, string>): string | null {
  const raw = headers.authorization ?? headers.Authorization;
  if (typeof raw !== 'string') {
    return null;
  }
  const m = /^Bearer\s+(.+)$/.exec(raw);
  if (!m) {
    return null;
  }
  return m[1] as string;
}

/** Build a JSON response with `application/json` content-type. */
export function jsonResponse(status: number, payload: unknown): RouteResponse {
  return {
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

/** Standard error-body shape. */
export interface ErrorBody {
  readonly error: string;
  readonly reason?: string;
}
