// packages/on-device-player-ops/src/recorder.ts
// `OnDeviceTelemetryRecorder` (T-401). Developer-facing testing harness
// that captures `TelemetryEvent`s for assertions. Tests inject the
// recorder's `asSink` as the shim's `emitTelemetry` callback; the
// recorder appends every event to `recorded` in arrival order. `byKind`
// returns a typed slice for ergonomic assertions.

import type { TelemetryEvent } from '@stageflip/runtime-on-device-player';

/**
 * In-memory event recorder for tests. Not deterministic-perimeter
 * code; used in test files only.
 */
export interface OnDeviceTelemetryRecorder {
  readonly recorded: TelemetryEvent[];
  readonly asSink: (event: TelemetryEvent) => void;
  byKind<TKind extends TelemetryEvent['kind']>(
    kind: TKind,
  ): Extract<TelemetryEvent, { kind: TKind }>[];
  clear(): void;
}

/** Create a fresh recorder. The `recorded` array is mutated in-place. */
export function createTelemetryRecorder(): OnDeviceTelemetryRecorder {
  const recorded: TelemetryEvent[] = [];

  const asSink = (event: TelemetryEvent): void => {
    recorded.push(event);
  };

  function byKind<TKind extends TelemetryEvent['kind']>(
    kind: TKind,
  ): Extract<TelemetryEvent, { kind: TKind }>[] {
    return recorded.filter(
      (event): event is Extract<TelemetryEvent, { kind: TKind }> => event.kind === kind,
    );
  }

  function clear(): void {
    recorded.length = 0;
  }

  return { recorded, asSink, byKind, clear };
}
