// packages/marketplace-telemetry-dashboard/src/aggregations/install-count.ts
// T-541 — Pure aggregation: install events grouped per UTC day or
// per ISO week (Monday-anchored). Operates on raw `TimeSeriesEvent[]`;
// only `kind: 'install'` rows contribute to the count.
//
// Determinism perimeter: outside (server-side).

import type { TimeSeriesEvent } from '../storage/timeseries.js';

/** A daily install bucket. `dayIso` is `YYYY-MM-DD`. */
export interface InstallCountByDayPoint {
  readonly dayIso: string;
  readonly count: number;
}

/** A weekly install bucket. `weekStartIso` is the Monday `YYYY-MM-DD`. */
export interface InstallCountByWeekPoint {
  readonly weekStartIso: string;
  readonly count: number;
}

/** Extract the `YYYY-MM-DD` portion of an ISO 8601 UTC timestamp. */
function dayKey(at: string): string {
  return at.slice(0, 10);
}

/** Compute the Monday of the ISO week containing `at` (UTC), as `YYYY-MM-DD`. */
function weekStartKey(at: string): string {
  const d = new Date(`${dayKey(at)}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const offset = (dow + 6) % 7; // days since Monday
  const monday = new Date(d.getTime() - offset * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

/**
 * Count install events bucketed by UTC day. Output is sorted
 * ascending by `dayIso`. Days with no installs are NOT included
 * (callers may zero-fill if they want a continuous series).
 */
export function installCountByDay(
  events: readonly TimeSeriesEvent[],
): readonly InstallCountByDayPoint[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== 'install') continue;
    const k = dayKey(e.at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dayIso, count]) => ({ dayIso, count }));
}

/**
 * Count install events bucketed by ISO week (Monday-anchored UTC).
 * Output sorted ascending by `weekStartIso`.
 */
export function installCountByWeek(
  events: readonly TimeSeriesEvent[],
): readonly InstallCountByWeekPoint[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== 'install') continue;
    const k = weekStartKey(e.at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([weekStartIso, count]) => ({ weekStartIso, count }));
}
