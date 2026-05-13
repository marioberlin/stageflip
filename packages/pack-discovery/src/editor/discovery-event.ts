// packages/pack-discovery/src/editor/discovery-event.ts
// T-546 — Typed event payload the editor emits when the user
// interacts with a recommendation row. These flow into
// `@stageflip/pack-telemetry` (T-503) for product analytics; this
// module owns ONLY the shape + factory. The telemetry sink itself is
// not in pack-discovery's scope.
//
// `packIdHash` is a one-way hash supplied by the caller — the editor
// never sends raw publisher/pack identifiers off-device in telemetry.

/** The four user interactions worth tracking on a recommendation row. */
export type DiscoveryEventKind = 'impression' | 'click' | 'install' | 'dismiss';

/** A single discovery telemetry event. */
export interface DiscoveryEvent {
  readonly kind: DiscoveryEventKind;
  readonly packIdHash: string;
  /** ISO-8601 timestamp the event occurred at. */
  readonly atIso: string;
  /** Zero-based rank of the row in the recommendation list. */
  readonly position: number;
}

/** Factory options for `makeDiscoveryEvent`. */
export interface MakeDiscoveryEventOptions {
  readonly kind: DiscoveryEventKind;
  readonly packIdHash: string;
  readonly position: number;
  /** Override the timestamp source for determinism in tests. */
  readonly nowMs?: number;
}

/**
 * Construct a `DiscoveryEvent`. `nowMs` is optional — when omitted we
 * fall back to `Date.now()`. The caller is responsible for supplying a
 * pre-hashed `packIdHash`.
 */
export function makeDiscoveryEvent(opts: MakeDiscoveryEventOptions): DiscoveryEvent {
  const stamp = opts.nowMs ?? Date.now();
  return {
    kind: opts.kind,
    packIdHash: opts.packIdHash,
    atIso: new Date(stamp).toISOString(),
    position: opts.position,
  };
}
