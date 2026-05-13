// packages/marketplace-telemetry-dashboard/src/aggregations/retention.ts
// T-541 — Pure aggregation: cohort retention curve. For each install
// (anchored at the install day), measure the fraction of installs
// still "active" — i.e. emitted an activation with `mountedAnyClip`
// — on day `d` since install. Output is a per-day series where
// `activeFraction` ∈ [0, 1].
//
// Determinism perimeter: outside (server-side).

import type { TimeSeriesEvent } from '../storage/timeseries.js';

/** A single point on the retention curve. */
export interface RetentionPoint {
  readonly daysSinceInstall: number;
  readonly activeFraction: number;
}

/** UTC day-key for an ISO 8601 timestamp. */
function dayKey(at: string): string {
  return at.slice(0, 10);
}

/** Whole UTC days between two day-keys (`b - a`). Both `a` and `b` are
 *  `YYYY-MM-DD`. */
function dayDiff(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Compute a cohort retention curve from install + activation events.
 *
 * Algorithm:
 *   1. For each `(packIdHash, packVersion)` install row, record the
 *      first install day.
 *   2. For each activation row with `mountedAnyClip === true`, record
 *      its day.
 *   3. For each `daysSinceInstall = d` ∈ [0, maxObservedDelta], count
 *      the cohort members whose activation set contains
 *      `installDay + d`. Divide by cohort size to get
 *      `activeFraction`.
 *
 * Returns `[]` for empty input.
 */
export function retentionCurve(events: readonly TimeSeriesEvent[]): readonly RetentionPoint[] {
  const installDay = new Map<string, string>();
  const activeDays = new Map<string, Set<string>>();

  for (const e of events) {
    const key = `${e.packIdHash}@${e.packVersion}`;
    if (e.kind === 'install') {
      const d = dayKey(e.at);
      const prior = installDay.get(key);
      if (prior === undefined || d < prior) {
        installDay.set(key, d);
      }
    } else if (e.kind === 'activation' && e.payload.mountedAnyClip === true) {
      let set = activeDays.get(key);
      if (set === undefined) {
        set = new Set<string>();
        activeDays.set(key, set);
      }
      set.add(dayKey(e.at));
    }
  }

  const cohort = installDay.size;
  if (cohort === 0) return [];

  let maxDelta = 0;
  for (const [key, install] of installDay) {
    const days = activeDays.get(key);
    if (days === undefined) continue;
    for (const d of days) {
      const delta = dayDiff(install, d);
      if (delta >= 0 && delta > maxDelta) maxDelta = delta;
    }
  }

  const out: RetentionPoint[] = [];
  for (let d = 0; d <= maxDelta; d += 1) {
    let active = 0;
    for (const [key, install] of installDay) {
      const days = activeDays.get(key);
      if (days === undefined) continue;
      const target = new Date(new Date(`${install}T00:00:00Z`).getTime() + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (days.has(target)) active += 1;
    }
    out.push({ daysSinceInstall: d, activeFraction: active / cohort });
  }
  return out;
}
