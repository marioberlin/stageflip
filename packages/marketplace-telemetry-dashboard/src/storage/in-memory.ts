// packages/marketplace-telemetry-dashboard/src/storage/in-memory.ts
// T-541 — In-memory `TimeSeriesStore` for unit tests + local dev.
// Stores events in a single array; query filters in-process. A
// Cloud Bigtable adapter (T-550) replaces this in production.
//
// Determinism perimeter: outside (server-side).

import type { TimeSeriesEvent, TimeSeriesQuery, TimeSeriesStore } from './timeseries.js';

/**
 * Simple, deterministic in-memory implementation of `TimeSeriesStore`.
 * Inserts are appended; queries scan the buffer and apply filters.
 *
 * The shim is correctness-first; cost is O(n) per query. Production
 * deployments switch to a real time-series store via the
 * `TimeSeriesStore` interface.
 */
export class InMemoryTimeSeriesStore implements TimeSeriesStore {
  private readonly events: TimeSeriesEvent[] = [];

  /** Append events to the in-memory buffer (defensive copy of each row). */
  readonly write = async (events: readonly TimeSeriesEvent[]): Promise<void> => {
    for (const e of events) {
      this.events.push({
        kind: e.kind,
        packIdHash: e.packIdHash,
        packVersion: e.packVersion,
        at: e.at,
        payload: { ...e.payload },
      });
    }
  };

  /** Range scan with optional `kind` + `packIdHash` filtering. The
   *  `fromIso` bound is inclusive; `toIso` is exclusive — matches the
   *  half-open interval convention. */
  readonly query = async (opts: TimeSeriesQuery): Promise<readonly TimeSeriesEvent[]> => {
    const out: TimeSeriesEvent[] = [];
    for (const e of this.events) {
      if (opts.kind !== undefined && e.kind !== opts.kind) {
        continue;
      }
      if (opts.packIdHash !== undefined && e.packIdHash !== opts.packIdHash) {
        continue;
      }
      if (e.at < opts.fromIso || e.at >= opts.toIso) {
        continue;
      }
      out.push(e);
    }
    return out;
  };

  /** Total event count (for tests). */
  readonly size = (): number => this.events.length;
}
