// packages/usage-telemetry/src/in-memory-emitter.ts
// `InMemoryUsageTelemetryEmitter` — bounded ring buffer. Mirrors
// T-444's `InMemoryAuditEmitter` shape so wiring patterns stay
// uniform. Production transports (Cloud Logging / Prometheus / OTLP)
// land downstream — T-445 ships only the seam + the default in-memory
// impl for tests + dev hosts.
//
// Determinism posture: pure sync; no clock, no RNG, no I/O. Overflow
// drops oldest (FIFO).

import type { AdapterUsageEvent, UsageTelemetryEmitter, UsageTelemetryReader } from './types.js';

/** Default ring-buffer capacity. Overflow drops oldest. */
const DEFAULT_CAPACITY = 1000;

/**
 * In-memory ring-buffer usage emitter + reader. Implements BOTH
 * `UsageTelemetryEmitter` (write side) and `UsageTelemetryReader`
 * (read side) so a single instance can satisfy both seams on
 * `AssetGenerationContext`.
 *
 * `capacity` cap is enforced by `Array.shift()` when the buffer
 * exceeds it; the drop counter is surfaced via `droppedCount()` for
 * tests asserting overflow behavior.
 */
export class InMemoryUsageTelemetryEmitter implements UsageTelemetryEmitter, UsageTelemetryReader {
  private buffer: AdapterUsageEvent[] = [];
  private dropped = 0;
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(
        `InMemoryUsageTelemetryEmitter: capacity must be a positive integer; got ${String(capacity)}`,
      );
    }
    this.capacity = capacity;
  }

  emit(event: AdapterUsageEvent): void {
    this.buffer.push(event);
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
      this.dropped += 1;
    }
  }

  /** Snapshot of all events in emission order. Returns a fresh array. */
  events(): readonly AdapterUsageEvent[] {
    return [...this.buffer];
  }

  /** Events scoped to a single tenant, in emission order. Returns a fresh array. */
  eventsForTenant(tenantId: string): readonly AdapterUsageEvent[] {
    return this.buffer.filter((e) => e.tenantId === tenantId);
  }

  /** Number of events dropped due to overflow since the last clear. */
  droppedCount(): number {
    return this.dropped;
  }

  /** Test seam — resets buffer + drop counter. */
  clear(): void {
    this.buffer = [];
    this.dropped = 0;
  }
}
