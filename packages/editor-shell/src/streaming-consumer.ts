// packages/editor-shell/src/streaming-consumer.ts
// T-442 — Client-side SSE consumer for /api/agent/execute?stream=true.
// Reads the Response body as a ReadableStream<Uint8Array>, splits on
// the SSE record delimiter (`\n\n`), decodes each record, and dispatches
// the resulting StreamEvent to a typed handler map. Partial frames
// that straddle a network chunk boundary are buffered until the
// terminator arrives. Comment-only frames (`: keepalive\n\n`) are
// silently dropped — they exist purely to keep the TCP connection
// alive through aggressive intermediaries.
//
// Server side: packages/agent/src/streaming.ts +
//              apps/stageflip-slide/src/app/api/agent/execute/route.ts.

import {
  type ExecutorEvent,
  type PlanCancelledEvent,
  type StreamEvent,
  type ValidationCompleteEvent,
  decodeExecutorEventFromSse,
} from '@stageflip/agent';

/**
 * Per-event-kind handlers. Each is optional so callers wire only the
 * events they care about. Payloads are type-narrowed per kind so the
 * consumer doesn't need its own switch statement.
 */
export interface AgentStreamHandlers {
  onStepStart?: (e: Extract<ExecutorEvent, { kind: 'step-start' }>) => void;
  onToolCall?: (e: Extract<ExecutorEvent, { kind: 'tool-call' }>) => void;
  onToolResult?: (e: Extract<ExecutorEvent, { kind: 'tool-result' }>) => void;
  onPatchApplied?: (e: Extract<ExecutorEvent, { kind: 'patch-applied' }>) => void;
  onStepEnd?: (e: Extract<ExecutorEvent, { kind: 'step-end' }>) => void;
  onPlanEnd?: (e: Extract<ExecutorEvent, { kind: 'plan-end' }>) => void;
  onValidationComplete?: (e: ValidationCompleteEvent) => void;
  onCancelled?: (e: PlanCancelledEvent) => void;
  /**
   * Catch-all called for every event AFTER its specific handler (if
   * any). Useful for telemetry / debug logging without duplicating
   * dispatch logic.
   */
  onAny?: (e: StreamEvent) => void;
}

/**
 * Consume an SSE response body and dispatch each decoded event into
 * the provided handler map. Resolves when the stream closes normally;
 * rejects only on a fatal read error or a malformed frame the decoder
 * cannot parse.
 *
 * The caller is responsible for invoking `fetch` with the right
 * Accept header + (optionally) an AbortSignal for cancellation; this
 * consumer does NOT swallow the response body — it reads it to end.
 */
export async function consumeAgentStream(
  response: Response,
  handlers: AgentStreamHandlers,
): Promise<void> {
  if (!response.body) {
    throw new Error('consumeAgentStream: Response has no body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      if (done) {
        buffer += decoder.decode();
        break;
      }

      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const rawFrame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        dispatchFrame(rawFrame, handlers);
        idx = buffer.indexOf('\n\n');
      }
    }
    // Tail: a final frame with no trailing blank line. SSE servers
    // SHOULD always send the blank line, but be defensive.
    if (buffer.trim().length > 0) {
      dispatchFrame(buffer, handlers);
    }
  } finally {
    reader.releaseLock();
  }
}

function dispatchFrame(rawFrame: string, handlers: AgentStreamHandlers): void {
  const trimmed = rawFrame.replace(/^\s+|\s+$/g, '');
  if (trimmed.length === 0) return;
  // SSE comment frames look like `: keepalive` — drop silently. A
  // comment frame has every line starting with `:`.
  const lines = trimmed.split('\n');
  if (lines.every((line) => line.startsWith(':'))) return;

  // The decoder expects the trailing blank line; restore it for the
  // canonical wire format.
  const event = decodeExecutorEventFromSse(`${trimmed}\n\n`);
  routeEvent(event, handlers);
}

function routeEvent(event: StreamEvent, handlers: AgentStreamHandlers): void {
  switch (event.kind) {
    case 'step-start':
      handlers.onStepStart?.(event);
      break;
    case 'tool-call':
      handlers.onToolCall?.(event);
      break;
    case 'tool-result':
      handlers.onToolResult?.(event);
      break;
    case 'patch-applied':
      handlers.onPatchApplied?.(event);
      break;
    case 'step-end':
      handlers.onStepEnd?.(event);
      break;
    case 'plan-end':
      handlers.onPlanEnd?.(event);
      break;
    case 'validation-complete':
      handlers.onValidationComplete?.(event);
      break;
    case 'plan-cancelled':
      handlers.onCancelled?.(event);
      break;
  }
  handlers.onAny?.(event);
}
