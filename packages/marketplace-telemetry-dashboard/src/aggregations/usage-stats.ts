// packages/marketplace-telemetry-dashboard/src/aggregations/usage-stats.ts
// T-541 — Pure aggregation: average `clipMountCount` across usage
// events. The denominator is the count of usage events (one per
// active install per reporting window).
//
// Determinism perimeter: outside (server-side).

import type { TimeSeriesEvent } from '../storage/timeseries.js';

/** Read `clipMountCount` from a usage-event payload, returning `0`
 *  for malformed rows. */
function readMountCount(payload: Record<string, unknown>): number {
  const v = payload.clipMountCount;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    return v;
  }
  return 0;
}

/**
 * Average clip-mount count across all `usage` events in the input.
 * Returns `0` for empty input or when no usage events are present.
 */
export function averageClipMountCount(events: readonly TimeSeriesEvent[]): number {
  let total = 0;
  let n = 0;
  for (const e of events) {
    if (e.kind !== 'usage') continue;
    total += readMountCount(e.payload);
    n += 1;
  }
  return n === 0 ? 0 : total / n;
}
