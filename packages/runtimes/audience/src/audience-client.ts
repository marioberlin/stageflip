// packages/runtimes/audience/src/audience-client.ts
// `AudienceClient` — thin wrapper over an `AudienceBackendProvider`'s
// `subscribe()` async iterable. Handles the ADR-009 §D6 reconnect-budget
// policy (6 retries × `min(2^attempt × 1s, 30s)` exponential backoff)
// and emits `LF-AUDIENCE-CONNECTION-LOST` (the eighth client-side
// loss-flag code) on budget exhaustion. Close-code `4000` (graceful
// server close, ADR-009 §D6) short-circuits — no reconnect attempt.
//
// The client is provider-agnostic by design (ADR-009 §D2): the native
// provider (T-478) implements the actual WebSocket; vendor providers
// (T-479..T-483) translate vendor APIs. The runtime sees only the
// `AsyncIterable<AggregationSnapshot>` surface.
//
// Determinism perimeter (CLAUDE.md §3): the broad determinism rule scopes
// to `packages/runtimes/*\/src/clips/**`, so `src/audience-client.ts`
// (NOT under `clips/`) is OUT of the broad scan. Per ADR-009 §D10 the
// audience runtime is INSIDE the conceptual perimeter — the
// non-deterministic surfaces (reconnect-budget timer, abort handling)
// are isolated to THIS module and tagged with `determinism-safe`
// comments citing ADR-009 §D6.

import type {
  AggregationSnapshot,
  AudienceBackendProvider,
  SubscribeCall,
} from '@stageflip/audience-contract';

import type { AudienceEmitLossFlag } from './contract.js';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/**
 * Outcome of a `subscribe()` iteration loop.
 *  - `'completed'` — the provider's iterator closed gracefully (server
 *    sent close code 4000 or the consumer aborted).
 *  - `'budget-exhausted'` — the reconnect budget hit zero before the
 *    provider yielded a new snapshot. `LF-AUDIENCE-CONNECTION-LOST` was
 *    emitted before the promise resolved.
 */
export type AudienceClientOutcome = 'completed' | 'budget-exhausted';

/**
 * Per-iteration sink. Called once per `AggregationSnapshot` the
 * provider yields. May be async — the client awaits the returned
 * promise before pulling the next snapshot, giving consumers natural
 * back-pressure.
 */
export type AudienceSnapshotSink = (snapshot: AggregationSnapshot) => void | Promise<void>;

/**
 * Per-reconnect-attempt observer. Optional; useful for tests + host
 * telemetry. Called BEFORE the backoff timer schedules the next attempt.
 * `attempt` is 1-based: the first reconnect after the initial socket
 * drop is `attempt: 1`.
 */
export type AudienceReconnectObserver = (event: {
  readonly attempt: number;
  readonly delayMs: number;
  readonly cause: 'error' | 'iterator-end';
}) => void;

/**
 * Schedule-time-after-delay shim. `setTimeoutFn` in production defaults
 * to `globalThis.setTimeout`; tests inject a fake-timers implementation.
 * Returning a cancel handle keeps the abort path tight (no leaked
 * timers when `signal` aborts during a backoff window).
 */
export type SetTimeoutFn = (fn: () => void, ms: number) => unknown;

/** Cancel a previously-scheduled `setTimeoutFn` handle. */
export type ClearTimeoutFn = (handle: unknown) => void;

/**
 * Server-graceful close code per ADR-009 §D6. When the provider's
 * `subscribe()` iterator throws a `{ code: 4000 }`-shaped object (or an
 * `Error` with `name === 'GracefulCloseError'`), the client treats the
 * stream as completed — no reconnect attempt.
 */
export const GRACEFUL_CLOSE_CODE = 4000;

/**
 * Reconnect-budget policy per ADR-009 §D6. Six attempts; each delay is
 * `min(2^attempt × 1s, 30s)`:
 *
 *   attempt 1 →  2 s
 *   attempt 2 →  4 s
 *   attempt 3 →  8 s
 *   attempt 4 → 16 s
 *   attempt 5 → 30 s (capped)
 *   attempt 6 → 30 s (capped)
 *
 * Total budget ≈ 90 s before `LF-AUDIENCE-CONNECTION-LOST` fires.
 */
export const RECONNECT_MAX_ATTEMPTS = 6;
export const RECONNECT_MAX_DELAY_MS = 30_000;

/**
 * Compute the backoff delay for the n-th attempt (1-based) per the
 * ADR-009 §D6 formula. Exported so tests + the host telemetry can pin
 * the schedule.
 */
export function computeBackoffMs(attempt: number): number {
  if (attempt < 1) throw new RangeError(`computeBackoffMs: attempt must be >= 1, got ${attempt}`);
  const exp = 2 ** attempt * 1000;
  return Math.min(exp, RECONNECT_MAX_DELAY_MS);
}

/**
 * Construction options for `AudienceClient`. `provider` + `subscribeCall`
 * are required; everything else is injectable for tests.
 */
export interface AudienceClientOptions {
  /** The audience-backend provider that hosts this session. */
  readonly provider: AudienceBackendProvider;
  /** Subscribe call (sessionId + authToken) per ADR-009 §D2. */
  readonly subscribeCall: SubscribeCall;
  /** Snapshot sink — called once per yielded `AggregationSnapshot`. */
  readonly onSnapshot: AudienceSnapshotSink;
  /** Loss-flag emitter — used for `LF-AUDIENCE-CONNECTION-LOST`. */
  readonly emitLossFlag: AudienceEmitLossFlag;
  /**
   * Cancellation signal. Aborting disposes the client: iterator close,
   * pending backoff timer cleared, no further snapshots delivered.
   */
  readonly signal: AbortSignal;
  /** Optional reconnect observer (test + telemetry hook). */
  readonly onReconnectAttempt?: AudienceReconnectObserver;
  /**
   * Optional `setTimeout` shim — tests inject fake timers. Defaults to
   * `globalThis.setTimeout`. The reconnect-budget timer is the ONE
   * non-deterministic primitive the runtime uses; it is intentional per
   * ADR-009 §D6.
   */
  readonly setTimeoutFn?: SetTimeoutFn;
  /** Optional `clearTimeout` shim companion to `setTimeoutFn`. */
  readonly clearTimeoutFn?: ClearTimeoutFn;
}

/**
 * Subscribe-error shape the provider may surface via the iterator's
 * `throw`. Either an `Error` carrying `code` / `wasClean`, or an
 * already-thrown object with a `code` field — we duck-type because the
 * native provider (T-478) and vendor adapters surface different shapes.
 */
function isGracefulClose(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === 'object') {
    const e = err as { code?: unknown; wasClean?: unknown; name?: unknown };
    if (e.code === GRACEFUL_CLOSE_CODE) return true;
    if (e.name === 'GracefulCloseError') return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// AudienceClient — the run loop
// ----------------------------------------------------------------------------

/**
 * Run the audience-client subscribe loop. Resolves with `'completed'`
 * on graceful close + abort, or `'budget-exhausted'` after the 6-attempt
 * reconnect budget exhausts (and emits `LF-AUDIENCE-CONNECTION-LOST`).
 *
 * The function is a free function — not a class — because the lifetime
 * is wholly bounded by the supplied `signal`. The factory wraps it in a
 * `MountHandle` whose `dispose()` aborts the controller.
 */
export async function runAudienceClient(
  options: AudienceClientOptions,
): Promise<AudienceClientOutcome> {
  const {
    provider,
    subscribeCall,
    onSnapshot,
    emitLossFlag,
    signal,
    onReconnectAttempt,
    // determinism-safe: WebSocket reconnect timer — non-deterministic by ADR-009 §D6 design; lives behind the AudienceClient boundary
    setTimeoutFn = globalThis.setTimeout.bind(globalThis) as SetTimeoutFn,
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis) as ClearTimeoutFn,
  } = options;

  let attempt = 0;

  while (!signal.aborted) {
    const cause = await runOneSubscribe(provider, subscribeCall, onSnapshot, signal);
    if (cause === 'graceful' || signal.aborted) return 'completed';

    attempt += 1;
    if (attempt > RECONNECT_MAX_ATTEMPTS) {
      emitLossFlag({
        code: 'LF-AUDIENCE-CONNECTION-LOST',
        message: `Audience WebSocket reconnect budget exhausted after ${RECONNECT_MAX_ATTEMPTS} attempts (ADR-009 §D6).`,
        location: {},
      });
      return 'budget-exhausted';
    }

    const delayMs = computeBackoffMs(attempt);
    onReconnectAttempt?.({ attempt, delayMs, cause });

    const slept = await sleep(delayMs, signal, setTimeoutFn, clearTimeoutFn);
    if (!slept) return 'completed';
  }

  return 'completed';
}

/**
 * Run one `provider.subscribe()` iteration. Returns:
 *  - `'graceful'` on iterator-end + close-code-4000 / abort.
 *  - `'error'` on non-graceful throw from the iterator.
 *  - `'iterator-end'` on natural iterator-end without explicit close.
 *    (Distinct from `'graceful'` because some providers terminate the
 *    iterator without a close-code event — we treat this as
 *    reconnect-worthy.)
 */
async function runOneSubscribe(
  provider: AudienceBackendProvider,
  subscribeCall: SubscribeCall,
  onSnapshot: AudienceSnapshotSink,
  signal: AbortSignal,
): Promise<'graceful' | 'error' | 'iterator-end'> {
  let iterator: AsyncIterator<AggregationSnapshot> | undefined;
  try {
    const iterable = provider.subscribe(subscribeCall);
    iterator = iterable[Symbol.asyncIterator]();
    while (!signal.aborted) {
      const next = await iterator.next();
      if (next.done) return 'iterator-end';
      await onSnapshot(next.value);
    }
    return 'graceful';
  } catch (err) {
    if (isGracefulClose(err)) return 'graceful';
    return 'error';
  } finally {
    if (iterator !== undefined && typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch {
        // swallow: iterator-return errors during dispose are non-actionable
      }
    }
  }
}

/**
 * Sleep with abort support. Returns `true` if the delay elapsed
 * normally; `false` if the abort signal fired during the delay.
 */
function sleep(
  ms: number,
  signal: AbortSignal,
  setTimeoutFn: SetTimeoutFn,
  clearTimeoutFn: ClearTimeoutFn,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const handle = setTimeoutFn(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = (): void => {
      clearTimeoutFn(handle);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
