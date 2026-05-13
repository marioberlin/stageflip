// packages/marketplace-telemetry-dashboard/src/storage/timeseries.ts
// T-541 — Abstract `TimeSeriesStore` interface + `TimeSeriesEvent`
// shape. Production wires a Cloud Bigtable adapter (deferred to T-550)
// behind this interface; tests + local dev use `InMemoryTimeSeriesStore`.
//
// Determinism perimeter: outside (server-side telemetry).

/** Discriminated kind tag mirroring `@stageflip/pack-telemetry`'s
 *  three event kinds. Stored in the time-series row. */
export type TimeSeriesEventKind = 'install' | 'activation' | 'usage';

/**
 * Persisted shape of a single telemetry event. The `payload` map
 * carries kind-specific fields (e.g. `mountedAnyClip` for activation,
 * `clipMountCount` + `windowSeconds` for usage). The receiver
 * normalises incoming `PackTelemetryEvent`s into this row before
 * handing them to the store.
 */
export interface TimeSeriesEvent {
  readonly kind: TimeSeriesEventKind;
  /** SHA-256 of `<publisherId>/<packId>` — anonymous identifier. */
  readonly packIdHash: string;
  readonly packVersion: string;
  /** ISO 8601 UTC timestamp, second resolution. */
  readonly at: string;
  /** Kind-specific fields. Opaque to the store. */
  readonly payload: Record<string, unknown>;
}

/** Query options for `TimeSeriesStore.query`. */
export interface TimeSeriesQuery {
  readonly packIdHash?: string;
  readonly kind?: TimeSeriesEventKind;
  /** Inclusive lower bound, ISO 8601 UTC. */
  readonly fromIso: string;
  /** Exclusive upper bound, ISO 8601 UTC. */
  readonly toIso: string;
}

/**
 * Backing store for telemetry events. Production: Cloud Bigtable;
 * tests / dev: `InMemoryTimeSeriesStore`. The interface is deliberately
 * narrow — write a batch + range-query — so a real adapter slots in
 * without touching aggregation code.
 */
export interface TimeSeriesStore {
  /** Append a batch of events. Idempotency is the caller's concern. */
  readonly write: (events: readonly TimeSeriesEvent[]) => Promise<void>;
  /** Range-scan with optional kind / packIdHash filter. */
  readonly query: (opts: TimeSeriesQuery) => Promise<readonly TimeSeriesEvent[]>;
}
