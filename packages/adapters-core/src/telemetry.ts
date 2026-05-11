// packages/adapters-core/src/telemetry.ts
// Minimal telemetry hook shape — mirrors `EmitTelemetry` in
// `packages/runtimes/interactive/src/contract.ts:57`. Adapters-core itself
// never emits OpenTelemetry directly; the routing engine (T-425) and the
// fallback executor accept an `EmitTelemetry` injected by the host shell
// and forward to the host's OTel pipeline (wired in T-264).
//
// Default `noopEmitTelemetry` swallows events — used when callers do not
// supply an emitter (tests, in-memory dev, etc.).

/**
 * Telemetry hook. Receives an event name + arbitrary structured attributes.
 * Hosts wire this into OpenTelemetry / log-based observability. Adapters-core
 * itself never imports OTel — the contract is a function reference.
 */
export type EmitTelemetry = (event: string, attributes: Record<string, unknown>) => void;

/** No-op emitter. Default for tests and dev wiring. */
export const noopEmitTelemetry: EmitTelemetry = () => {};
