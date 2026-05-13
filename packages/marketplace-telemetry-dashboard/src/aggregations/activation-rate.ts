// packages/marketplace-telemetry-dashboard/src/aggregations/activation-rate.ts
// T-541 — Pure aggregation: ratio of installs that produced at least
// one activation event with `mountedAnyClip === true`.
//
// Determinism perimeter: outside (server-side).

import type { TimeSeriesEvent } from '../storage/timeseries.js';

/** Ratio + raw counts so callers can render either. */
export interface ActivationRateResult {
  readonly installs: number;
  readonly activations: number;
  /** `activations / installs`; `0` when `installs === 0`. */
  readonly rate: number;
}

/**
 * Compute the activation rate over the supplied event stream. An
 * "active" pack is one whose hash appears with `kind: 'activation'`
 * and `payload.mountedAnyClip === true` at least once. The denominator
 * is the count of distinct `(packIdHash, packVersion)` install rows.
 *
 * Returns `{ installs: 0, activations: 0, rate: 0 }` for an empty input.
 */
export function activationRate(events: readonly TimeSeriesEvent[]): ActivationRateResult {
  const installSet = new Set<string>();
  const activeSet = new Set<string>();
  for (const e of events) {
    const key = `${e.packIdHash}@${e.packVersion}`;
    if (e.kind === 'install') {
      installSet.add(key);
    } else if (e.kind === 'activation' && e.payload.mountedAnyClip === true) {
      activeSet.add(key);
    }
  }
  const installs = installSet.size;
  // Activations are only counted against installs we observed; this
  // keeps the rate ∈ [0, 1] even if the activation arrives in a window
  // where the install pre-dates the query range.
  let activations = 0;
  for (const k of activeSet) {
    if (installSet.has(k)) {
      activations += 1;
    }
  }
  const rate = installs === 0 ? 0 : activations / installs;
  return { installs, activations, rate };
}
