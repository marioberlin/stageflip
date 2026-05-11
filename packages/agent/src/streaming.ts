// packages/agent/src/streaming.ts
// T-442 — SSE encoder + ReadableStream wrapper for ExecutorEvents.
// Pure transport layer. Sits over the existing
// `Executor.run(): AsyncIterable<ExecutorEvent>` shape without changing
// it. Wire format follows the WHATWG / RFC 8895 SSE spec: each frame is
// `id: <n>\nevent: <kind>\ndata: <json>\n\n`. A transport-only
// sentinel (`plan-cancelled`) is emitted when the wrapping
// AbortSignal fires mid-stream so consumers can distinguish a clean
// completion from a truncated one. The sentinel is NOT a member of the
// canonical `ExecutorEvent` union — it lives only on the wire.
//
// See docs/tasks/T-442.md + skills/stageflip/concepts/streaming-agent-events.

import type { ValidationResult } from './validator/types.js';
import type { ExecutorEvent } from './executor/types.js';

/** Discriminator for the transport-only abort sentinel. */
export const PLAN_CANCELLED_KIND = 'plan-cancelled' as const;

/** Discriminator for the transport-only validator-result event. */
export const VALIDATION_COMPLETE_KIND = 'validation-complete' as const;

/**
 * Transport-only sentinel emitted when the upstream AbortSignal fires
 * mid-stream. Lets the client tell apart a clean completion from a
 * truncated one.
 */
export interface PlanCancelledEvent {
  readonly kind: typeof PLAN_CANCELLED_KIND;
  readonly reason: 'aborted';
}

/**
 * Transport-only event emitted by the streamAgent orchestrator after
 * the Executor's `plan-end` to surface the Validator verdict on the
 * same SSE channel. Kept off the canonical `ExecutorEvent` union so
 * the executor stays a pure plan-execution stream.
 */
export interface ValidationCompleteEvent {
  readonly kind: typeof VALIDATION_COMPLETE_KIND;
  readonly validation: ValidationResult;
}

/**
 * Wire-level event union: every {@link ExecutorEvent} plus the two
 * transport-only events ({@link PlanCancelledEvent},
 * {@link ValidationCompleteEvent}).
 */
export type StreamEvent = ExecutorEvent | PlanCancelledEvent | ValidationCompleteEvent;

/** Discriminators allowed on the wire (executor + transport). */
const WIRE_KINDS = new Set<string>([
  'step-start',
  'tool-call',
  'tool-result',
  'patch-applied',
  'step-end',
  'plan-end',
  PLAN_CANCELLED_KIND,
  VALIDATION_COMPLETE_KIND,
]);

/** Encode one event as a single SSE frame (terminated with `\n\n`). */
export function encodeExecutorEventAsSse(event: StreamEvent, id: number): string {
  if (!WIRE_KINDS.has(event.kind)) {
    throw new Error(`encodeExecutorEventAsSse: unknown event kind: ${event.kind}`);
  }
  const data = JSON.stringify(event);
  return `id: ${id}\nevent: ${event.kind}\ndata: ${data}\n\n`;
}

/**
 * Decode a single SSE frame back into a {@link StreamEvent}. Inverse of
 * {@link encodeExecutorEventAsSse}. Throws on missing fields, malformed
 * JSON, or discriminator/data.kind disagreement.
 */
export function decodeExecutorEventFromSse(frame: string): StreamEvent {
  const lines = frame.split('\n');
  let eventField: string | undefined;
  let dataField: string | undefined;
  for (const line of lines) {
    if (line.startsWith('event: ')) eventField = line.slice('event: '.length);
    else if (line.startsWith('data: ')) dataField = line.slice('data: '.length);
  }
  if (eventField === undefined) {
    throw new Error('decodeExecutorEventFromSse: missing event: line');
  }
  if (dataField === undefined) {
    throw new Error('decodeExecutorEventFromSse: missing data: line');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataField);
  } catch (err) {
    throw new Error(
      `decodeExecutorEventFromSse: data: payload is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('kind' in parsed) ||
    typeof (parsed as { kind: unknown }).kind !== 'string'
  ) {
    throw new Error('decodeExecutorEventFromSse: data payload missing `kind` discriminator');
  }
  const dataKind = (parsed as { kind: string }).kind;
  if (dataKind !== eventField) {
    throw new Error(
      `decodeExecutorEventFromSse: event/data.kind disagree (event=${eventField} vs data.kind=${dataKind})`,
    );
  }
  if (!WIRE_KINDS.has(dataKind)) {
    throw new Error(`decodeExecutorEventFromSse: unknown event kind: ${dataKind}`);
  }
  return parsed as StreamEvent;
}

/** Options for {@link toReadableStream}. */
export interface ToReadableStreamOptions {
  /**
   * Optional AbortSignal. When triggered, the wrapper:
   *  1. Calls `return()` on the upstream iterator (cooperative cancel).
   *  2. Emits a transport-only `plan-cancelled` sentinel frame.
   *  3. Closes the stream.
   */
  signal?: AbortSignal;
}

/**
 * Wrap an `AsyncIterable<StreamEvent>` as a `ReadableStream<Uint8Array>`
 * whose chunks are UTF-8 encoded SSE frames. Each frame carries a
 * monotonically-increasing `id` (per-stream, NOT cross-request).
 *
 * Backpressure is handled by `ReadableStream` natively — pulls drive
 * upstream iteration one event at a time.
 */
export function toReadableStream(
  iterable: AsyncIterable<StreamEvent>,
  options: ToReadableStreamOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = iterable[Symbol.asyncIterator]();
  let id = 0;
  let cancelled = false;
  let aborted = false;
  const { signal } = options;

  const onAbort = (): void => {
    aborted = true;
    // Best-effort: tell upstream we're done so it can clean up. Errors
    // from a generator's return() must not propagate into the stream.
    void iterator.return?.().catch(() => undefined);
  };

  if (signal) {
    if (signal.aborted) aborted = true;
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller): Promise<void> {
      if (cancelled) {
        controller.close();
        return;
      }
      if (aborted) {
        const sentinel: PlanCancelledEvent = { kind: PLAN_CANCELLED_KIND, reason: 'aborted' };
        controller.enqueue(encoder.encode(encodeExecutorEventAsSse(sentinel, id++)));
        controller.close();
        cancelled = true;
        return;
      }
      let next: IteratorResult<StreamEvent>;
      try {
        next = await iterator.next();
      } catch (err) {
        controller.error(err);
        return;
      }
      if (aborted) {
        // Abort fired while we were awaiting iterator.next() — emit
        // the sentinel instead of the value we just received.
        const sentinel: PlanCancelledEvent = { kind: PLAN_CANCELLED_KIND, reason: 'aborted' };
        controller.enqueue(encoder.encode(encodeExecutorEventAsSse(sentinel, id++)));
        controller.close();
        cancelled = true;
        return;
      }
      if (next.done) {
        controller.close();
        cancelled = true;
        return;
      }
      controller.enqueue(encoder.encode(encodeExecutorEventAsSse(next.value, id++)));
    },
    cancel(): void {
      cancelled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      void iterator.return?.().catch(() => undefined);
    },
  });
}
