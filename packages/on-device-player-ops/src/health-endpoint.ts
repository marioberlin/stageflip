// packages/on-device-player-ops/src/health-endpoint.ts
// HTTP-shape probe handler (T-401). Pure request/response transform —
// no real HTTP server lives here. The on-device player binary wires
// the handler to its own embedded HTTP server (Node `http`, Rust
// `hyper`, etc.); the operator's NMS / OpsRamp / fleet-monitor scrapes
// the endpoint. Per ADR-005 §D4 + L141 the binary lives at a higher
// security blast-radius than browser clips; keeping this layer pure
// keeps the test surface free of socket I/O.

import type { HealthProbeReport } from '@stageflip/on-device-player-packaging';

/** Inbound request descriptor. The binary maps its HTTP server framing to this. */
export interface HealthRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
}

/** Outbound response descriptor. The binary maps this to its HTTP server framing. */
export interface HealthResponse {
  readonly status: 200 | 405 | 404;
  readonly body: HealthProbeReport | { error: string };
}

/**
 * Build a pure HTTP-shape handler. Routing rules:
 *   - `GET /health` → 200 with a fresh `HealthProbeReport` from `probe()`.
 *   - `POST /health` → 405 (method not allowed).
 *   - Any other path → 404.
 *
 * The `probe()` callback is invoked at most once per request — once on
 * the success path and not at all on 405 / 404 responses.
 */
export function buildHealthHandler(args: {
  probe(): HealthProbeReport;
}): (request: HealthRequest) => HealthResponse {
  return (request: HealthRequest): HealthResponse => {
    if (request.path !== '/health') {
      return { status: 404, body: { error: 'not found' } };
    }
    if (request.method !== 'GET') {
      return { status: 405, body: { error: 'method not allowed' } };
    }
    return { status: 200, body: args.probe() };
  };
}
