// packages/marketplace-conversion/src/churn/strategy.ts
// T-544 — `ChurnRecoveryStrategy` declares the dunning / retry knobs
// the conversion planner consults when a `'lapsed-recovered'` event
// arrives for an entitlement still in a non-`'active'` state. The
// strategy is a pure value: no I/O, no scheduling. Callers feed the
// computed `backoffMs` into their own retry harness (T-550 wiring).
//
// Determinism perimeter: outside (server-side).

/**
 * Policy knobs for the churn-recovery retry harness.
 *
 * - `maxRetries`: cap on retry attempts before the planner emits a
 *   `noop` ("churn-final") instead of `churn-recovery-retry`.
 * - `baseBackoffMs`: starting delay before the first retry attempt
 *   (retryCount === 0 returns this value).
 * - `maxBackoffMs`: hard ceiling — `nextBackoff` never exceeds this
 *   regardless of `retryCount`.
 * - `nextBackoff`: pure function mapping `retryCount` (zero-indexed
 *   attempt number) to the next delay in ms. Exponential growth is
 *   the platform default; deployments may inject linear / jittered
 *   schedules without forking the strategy shape.
 */
export interface ChurnRecoveryStrategy {
  readonly maxRetries: number;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly nextBackoff: (retryCount: number) => number;
}

/** One hour in ms — default `baseBackoffMs`. */
export const DEFAULT_BASE_BACKOFF_MS = 3_600_000;

/** Twenty-four hours in ms — default `maxBackoffMs`. */
export const DEFAULT_MAX_BACKOFF_MS = 86_400_000;

/** Default max-retries before the planner gives up. */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Exponential `nextBackoff`: `base * 2^retryCount`, clamped to
 * `maxBackoffMs`. Negative `retryCount` is normalised to zero.
 */
function exponentialBackoff(retryCount: number, base: number, max: number): number {
  const safeCount = retryCount < 0 ? 0 : retryCount;
  // 2^safeCount overflows JS-safe integers around safeCount=53; clamp
  // pre-emptively by capping the exponent we actually compute.
  const exponent = safeCount > 30 ? 30 : safeCount;
  const grown = base * 2 ** exponent;
  return grown > max ? max : grown;
}

/**
 * Platform-default churn-recovery strategy:
 *
 * - 3 retries (≈ 1h + 2h + 4h = 7h cumulative before giving up).
 * - 1h base, 24h ceiling — exponential growth.
 *
 * Production deployments may override via the second argument to
 * `planConversion`; tests use this constant directly.
 */
export const DEFAULT_CHURN_STRATEGY: ChurnRecoveryStrategy = {
  maxRetries: DEFAULT_MAX_RETRIES,
  baseBackoffMs: DEFAULT_BASE_BACKOFF_MS,
  maxBackoffMs: DEFAULT_MAX_BACKOFF_MS,
  nextBackoff: (retryCount: number): number =>
    exponentialBackoff(retryCount, DEFAULT_BASE_BACKOFF_MS, DEFAULT_MAX_BACKOFF_MS),
};
