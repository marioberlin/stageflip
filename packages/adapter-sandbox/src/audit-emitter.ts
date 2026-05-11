// packages/adapter-sandbox/src/audit-emitter.ts
// In-memory `AuditEmitter` implementation — bounded ring buffer. T-446
// wires the production `CloudLoggingAuditEmitter`; the in-memory variant
// here is the default for tests, dev, and any deployment that hasn't
// configured a transport yet.
//
// Determinism posture: pure sync; no clock, no RNG, no I/O. The ring
// buffer is a plain array — drops oldest on overflow.

import type { AdapterAuditEvent, AuditEmitter } from './types.js';

/** Default ring-buffer capacity. Overflow drops oldest. */
const DEFAULT_CAPACITY = 1000;

/**
 * In-memory ring-buffer audit emitter. Single-process, not thread-safe
 * in the worker-thread sense; fine for tests + single-Node dev.
 *
 * `capacity` cap is enforced by `Array.shift()` when the buffer
 * exceeds it; the drop counter is surfaced via `droppedCount()` for
 * tests asserting overflow behavior.
 */
export class InMemoryAuditEmitter implements AuditEmitter {
  private buffer: AdapterAuditEvent[] = [];
  private dropped = 0;
  private readonly capacity: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(
        `InMemoryAuditEmitter: capacity must be a positive integer; got ${String(capacity)}`,
      );
    }
    this.capacity = capacity;
  }

  emit(event: AdapterAuditEvent): void {
    this.buffer.push(event);
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
      this.dropped += 1;
    }
  }

  /** Snapshot of events in emission order. Returns a fresh array. */
  events(): readonly AdapterAuditEvent[] {
    return [...this.buffer];
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
