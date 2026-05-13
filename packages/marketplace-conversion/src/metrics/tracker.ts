// packages/marketplace-conversion/src/metrics/tracker.ts
// T-544 — `ConversionMetricsTracker` counts conversion outcomes for
// the T-541 telemetry dashboard. The tracker is in-memory + pure;
// the deployment layer (T-550) snapshots the summary on a cadence
// and ships it to the dashboard's metrics store.
//
// Determinism perimeter: outside (server-side).

import type { ConversionEvent } from '../events/conversion-event.js';

/**
 * Terminal outcome for a single observed conversion event. Mapped
 * by the deployment layer after running the planner action +
 * observing the entitlement-store state.
 *
 * - `'converted'`: a `'trial-to-paid'` / `'trial-expired'` event
 *   that ended with the entitlement at `'active'`.
 * - `'expired'`: a `'trial-expired'` event that did NOT convert
 *   (entitlement stayed `'trial'` past expiry, or was revoked).
 * - `'recovered'`: a `'lapsed-recovered'` event whose churn-recovery
 *   loop succeeded — entitlement back at `'active'`.
 * - `'churned'`: a `'lapsed-recovered'` event whose churn-recovery
 *   loop exhausted its retries — entitlement stayed `'lapsed'` /
 *   `'revoked'`.
 */
export type ConversionOutcome = 'converted' | 'expired' | 'recovered' | 'churned';

/** Aggregated conversion-funnel summary. */
export interface ConversionMetricsSummary {
  readonly trialToPaid: number;
  readonly trialExpiredNoConversion: number;
  readonly lapsedRecovered: number;
  readonly lapsedChurned: number;
  /**
   * Trial-conversion rate: `trialToPaid / (trialToPaid +
   * trialExpiredNoConversion)`. Returns `0` when both counters are
   * zero (avoids NaN).
   */
  readonly conversionRate: number;
}

/**
 * In-memory tracker. The deployment layer instantiates one tracker
 * per metrics-snapshot window and calls `summary()` at the window
 * boundary; the snapshot is shipped to the dashboard and the
 * tracker is discarded.
 *
 * The class is intentionally simple — no persistence, no time-
 * series. The dashboard owns retention + aggregation.
 */
export class ConversionMetricsTracker {
  #trialToPaid = 0;
  #trialExpiredNoConversion = 0;
  #lapsedRecovered = 0;
  #lapsedChurned = 0;

  /**
   * Record a single (event, outcome) pair. Combinations that don't
   * map to a tracked counter are silently ignored — callers may
   * still emit them for audit-log purposes without polluting the
   * funnel.
   */
  recordEvent(event: ConversionEvent, outcome: ConversionOutcome): void {
    switch (event.kind) {
      case 'trial-to-paid':
        if (outcome === 'converted') {
          this.#trialToPaid += 1;
        }
        return;
      case 'trial-expired':
        if (outcome === 'converted') {
          this.#trialToPaid += 1;
        } else if (outcome === 'expired') {
          this.#trialExpiredNoConversion += 1;
        }
        return;
      case 'lapsed-recovered':
        if (outcome === 'recovered') {
          this.#lapsedRecovered += 1;
        } else if (outcome === 'churned') {
          this.#lapsedChurned += 1;
        }
        return;
    }
  }

  /** Build a fresh summary snapshot. */
  summary(): ConversionMetricsSummary {
    const denom = this.#trialToPaid + this.#trialExpiredNoConversion;
    const conversionRate = denom === 0 ? 0 : this.#trialToPaid / denom;
    return {
      trialToPaid: this.#trialToPaid,
      trialExpiredNoConversion: this.#trialExpiredNoConversion,
      lapsedRecovered: this.#lapsedRecovered,
      lapsedChurned: this.#lapsedChurned,
      conversionRate,
    };
  }
}
