// packages/adapters-core/src/fallback-executor.ts
// `FallbackChainExecutor` — iterates an ordered chain of adapters; on
// failure, captures an `AdapterError`, emits one telemetry event per
// failure, and continues to the next adapter; on success, short-circuits
// and returns. Returns either `{ ok: true, result, adapter, attempts }`
// or `{ ok: false, errors }`.
//
// Determinism posture (per ADR-007 §D10): adapters live OUTSIDE the
// determinism perimeter, but the executor itself is deterministic-by-
// construction — no `Date.now()` / `performance.now()` / RNG in its body.
// Telemetry payloads carry only deterministic fields (adapterId,
// modality, error message). Callers wanting timestamped telemetry inject
// a `clock?: () => number` option; the value is forwarded verbatim to
// telemetry attributes — the executor itself never reads the system clock.

import type { AdapterDescriptor, AdapterModalityKind } from './adapter-descriptor.js';
import { type EmitTelemetry, noopEmitTelemetry } from './telemetry.js';

/**
 * Per-failure record. `cause` is the original thrown value (typed `unknown`
 * because `Promise` rejection values are not constrained to `Error`).
 * `errorMessage` is `cause.message` when `cause instanceof Error`, else
 * the value's `String(...)` rendering — used for telemetry.
 */
export interface AdapterError {
  readonly adapterId: string;
  readonly modality: AdapterModalityKind;
  readonly cause: unknown;
  readonly errorMessage: string;
}

/**
 * Executor result. Discriminated by `ok`. On success, `attempts` is the
 * number of adapters attempted (1-indexed; the successful adapter is the
 * `attempts`-th tried).
 */
export type ExecuteResult<T> =
  | {
      readonly ok: true;
      readonly result: T;
      readonly adapter: AdapterDescriptor;
      readonly attempts: number;
    }
  | { readonly ok: false; readonly errors: readonly AdapterError[] };

/**
 * Optional execution options. `emitTelemetry` defaults to a no-op;
 * `clock` is forwarded into telemetry payloads when supplied (used by
 * tests / OTel pipelines that want monotonic ordering).
 */
export interface ExecuteOptions {
  readonly emitTelemetry?: EmitTelemetry;
  readonly clock?: () => number;
}

const FALLBACK_FAILURE_EVENT = 'adapter.fallback.failure';

/**
 * Fallback-chain executor. Iterates the supplied `adapters` in order;
 * each gets one shot via `call(adapter)`. First success short-circuits;
 * exhausted chain returns the aggregated error list.
 *
 * The executor is stateless past construction. Hosts MAY share one
 * instance across calls.
 */
export class FallbackChainExecutor {
  /**
   * Execute `call(adapter)` against each adapter in turn; return on first
   * success.
   *
   * Empty `adapters` returns `{ ok: false, errors: [] }` immediately. No
   * telemetry is emitted for the empty case (there was no failure to
   * report).
   */
  async execute<T>(
    adapters: readonly AdapterDescriptor[],
    call: (adapter: AdapterDescriptor) => Promise<T>,
    opts?: ExecuteOptions,
  ): Promise<ExecuteResult<T>> {
    const emit = opts?.emitTelemetry ?? noopEmitTelemetry;
    const clock = opts?.clock;

    const errors: AdapterError[] = [];
    let attempts = 0;
    for (const adapter of adapters) {
      attempts += 1;
      try {
        const result = await call(adapter);
        return { ok: true, result, adapter, attempts };
      } catch (cause) {
        const errorMessage = cause instanceof Error ? cause.message : String(cause);
        const error: AdapterError = {
          adapterId: adapter.id,
          modality: adapter.modality.kind,
          cause,
          errorMessage,
        };
        errors.push(error);
        const attributes: Record<string, unknown> = {
          adapterId: adapter.id,
          modality: adapter.modality.kind,
          errorMessage,
          attempt: attempts,
        };
        if (clock !== undefined) {
          attributes.timestamp = clock();
        }
        emit(FALLBACK_FAILURE_EVENT, attributes);
      }
    }
    return { ok: false, errors };
  }
}

/** Telemetry event name emitted on each fallback failure. Stable string. */
export const ADAPTER_FALLBACK_FAILURE_EVENT = FALLBACK_FAILURE_EVENT;
