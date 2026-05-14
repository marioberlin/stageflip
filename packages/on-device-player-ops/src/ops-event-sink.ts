// packages/on-device-player-ops/src/ops-event-sink.ts
// `OpsEventSink` contract + in-memory implementation (T-401). The sink
// is the seam the binary uses to forward each `TelemetryEvent` to its
// downstream ingestion target (Prometheus pushgateway, Datadog HTTP
// intake, etc.). The in-memory impl is for tests + dev-loop; production
// wires an HTTP-backed implementation outside this workspace.

import type { TelemetryEvent } from '@stageflip/runtime-on-device-player';

/** Per-event context. Carried alongside the event so the binary can tag rows. */
export interface OpsEventContext {
  readonly tenantId: string;
  readonly deviceId: string;
  readonly playerVersion: string;
}

/**
 * The ops-side sink contract. The binary instantiates one of these at
 * boot and wires `send` as a side effect of every `emitTelemetry` call.
 * `flush` is the binary's clean-shutdown hook (drain in-flight rows
 * before exit).
 */
export interface OpsEventSink {
  send(event: TelemetryEvent, context: OpsEventContext): Promise<void>;
  flush(): Promise<void>;
}

/** One recorded send. */
export interface RecordedOpsEvent {
  readonly event: TelemetryEvent;
  readonly tenantId: string;
  readonly deviceId: string;
  readonly playerVersion: string;
}

/**
 * In-memory `OpsEventSink`. Appends every `send` call to `sent[]`;
 * `flush()` is a no-op (there is nothing to drain). `reset()` empties
 * the buffer. Tests and dev-loops use this; production uses an HTTP
 * impl wired outside this workspace.
 */
export class InMemoryOpsEventSink implements OpsEventSink {
  readonly sent: RecordedOpsEvent[] = [];

  // eslint-disable-next-line @typescript-eslint/require-await -- in-memory; no real awaits
  async send(event: TelemetryEvent, context: OpsEventContext): Promise<void> {
    this.sent.push({
      event,
      tenantId: context.tenantId,
      deviceId: context.deviceId,
      playerVersion: context.playerVersion,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- in-memory; nothing to flush
  async flush(): Promise<void> {
    // no-op
  }

  reset(): void {
    this.sent.length = 0;
  }
}
