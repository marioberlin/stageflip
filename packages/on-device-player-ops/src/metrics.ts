// packages/on-device-player-ops/src/metrics.ts
// `MetricsAggregator` (T-401). Aggregates the per-event `TelemetryEvent`
// stream from `@stageflip/runtime-on-device-player` into ops-readable
// metrics: mount-success rate, refusal-reason histogram, errors-by-clip-
// family, uptime SLI, currently-mounted count, restart count.
//
// The aggregator is sink-shaped (`ingest(event, clock)`) so the binary
// can wire it as an additional consumer alongside whatever real sink
// pushes to Prometheus / Datadog. Snapshots are window-bucketed: callers
// pass a window duration; events older than `now - windowDurationSec`
// are excluded from the snapshot's per-counter totals.
//
// Uptime simplification: `uptimePctSinceBoot` is computed naively as
// `bootCount / max(bootCount, bootCount + shutdownCount - bootCount)` —
// see implementation comment. The real-binary equivalent will pair
// `boot..shutdown` cycles against wall-clock; this lightweight surface
// is good enough for fleet-rollup smoke checks.

import type {
  OnDevicePlayerRefusalReason,
  TelemetryEvent,
} from '@stageflip/runtime-on-device-player';

/** A point-in-time metrics snapshot. Immutable. */
export interface PlayerMetrics {
  readonly windowStartedAtSec: number;
  readonly windowDurationSec: number;
  readonly bootCount: number;
  readonly shutdownCount: number;
  readonly mountAttempts: number;
  readonly mountSuccesses: number;
  readonly mountRefusals: number;
  /** `mountSuccesses / mountAttempts` (0..1). 0 when attempts === 0. */
  readonly mountSuccessRate: number;
  readonly refusalsByReason: Readonly<Record<OnDevicePlayerRefusalReason, number>>;
  readonly errorsByClipFamily: Readonly<Record<string, number>>;
  /**
   * Uptime ratio derived from `boot`/`shutdown` event sequencing. See
   * `MetricsAggregator` doc-comment for the simplification. 0..1.
   */
  readonly uptimePctSinceBoot: number;
  /** Currently-mounted clip count (clamped to ≥ 0). */
  readonly currentlyMounted: number;
}

/**
 * Streaming aggregator. `ingest` is O(1); `snapshot` is O(N) over events
 * inside the window. The aggregator stores per-event timestamps so
 * window-bucketed snapshots can exclude stale events.
 */
export interface MetricsAggregator {
  /** Append one event. Pass a monotonic clock that returns seconds. */
  ingest(event: TelemetryEvent, clock: () => number): void;
  /**
   * Return a snapshot covering events whose timestamp falls inside
   * `[now - windowDurationSec, now]`. Default window is 600 seconds.
   */
  snapshot(clock: () => number, windowDurationSec?: number): PlayerMetrics;
  /** Drop all events + state. Returns the aggregator to its initial state. */
  reset(): void;
}

interface StoredEvent {
  readonly event: TelemetryEvent;
  readonly atSec: number;
}

const REFUSAL_REASONS: readonly OnDevicePlayerRefusalReason[] = [
  'tenant-flag-disabled',
  'preview-not-ga',
  'permission-refused',
  'capability-insufficient',
  'no-factory-registered',
];

function emptyRefusalHistogram(): Record<OnDevicePlayerRefusalReason, number> {
  const out = {} as Record<OnDevicePlayerRefusalReason, number>;
  for (const reason of REFUSAL_REASONS) {
    out[reason] = 0;
  }
  return out;
}

/**
 * Create a fresh `MetricsAggregator`. The aggregator owns the event log
 * but exposes only the streaming + snapshot surface — internal storage
 * is closure-scoped.
 */
export function createMetricsAggregator(): MetricsAggregator {
  let events: StoredEvent[] = [];

  function ingest(event: TelemetryEvent, clock: () => number): void {
    const atSec = clock();
    events.push({ event, atSec });
  }

  function snapshot(clock: () => number, windowDurationSec = 600): PlayerMetrics {
    const now = clock();
    const windowStart = now - windowDurationSec;
    const inWindow = events.filter((e) => e.atSec >= windowStart && e.atSec <= now);

    let bootCount = 0;
    let shutdownCount = 0;
    let mountAttempts = 0;
    let mountSuccesses = 0;
    let mountRefusals = 0;
    const refusalsByReason = emptyRefusalHistogram();
    const errorsByClipFamily: Record<string, number> = {};
    let currentlyMounted = 0;

    for (const { event } of inWindow) {
      switch (event.kind) {
        case 'boot':
          bootCount += 1;
          break;
        case 'shutdown':
          shutdownCount += 1;
          // shutdown unmounts everything currently mounted
          currentlyMounted = 0;
          break;
        case 'mount-attempted':
          mountAttempts += 1;
          break;
        case 'mount-success':
          mountSuccesses += 1;
          currentlyMounted += 1;
          break;
        case 'mount-refused':
          mountRefusals += 1;
          refusalsByReason[event.reason] += 1;
          errorsByClipFamily[event.clipFamily] = (errorsByClipFamily[event.clipFamily] ?? 0) + 1;
          break;
        case 'unmount':
          currentlyMounted = Math.max(0, currentlyMounted - 1);
          break;
      }
    }

    const mountSuccessRate = mountAttempts === 0 ? 0 : mountSuccesses / mountAttempts;

    // Uptime simplification: when bootCount > 0 and shutdownCount === 0
    // the player has been continuously up across the window. When
    // shutdownCount >= bootCount, every boot was followed by a shutdown
    // (player has cycled). The fleet-rollup binary computes the real
    // wall-clock ratio; this lightweight surface returns:
    //   - 1.0 when bootCount > 0 and shutdownCount === 0 (continuously up)
    //   - 0.0 when bootCount === 0
    //   - bootCount / (bootCount + shutdownCount) otherwise (rough mix)
    let uptimePctSinceBoot: number;
    if (bootCount === 0) {
      uptimePctSinceBoot = 0;
    } else if (shutdownCount === 0) {
      uptimePctSinceBoot = 1;
    } else {
      uptimePctSinceBoot = bootCount / (bootCount + shutdownCount);
    }

    return {
      windowStartedAtSec: windowStart,
      windowDurationSec,
      bootCount,
      shutdownCount,
      mountAttempts,
      mountSuccesses,
      mountRefusals,
      mountSuccessRate,
      refusalsByReason,
      errorsByClipFamily,
      uptimePctSinceBoot,
      currentlyMounted,
    };
  }

  function reset(): void {
    events = [];
  }

  return { ingest, snapshot, reset };
}
