// @vitest-environment node
// packages/editor-shell/src/streaming-consumer.test.ts
// T-442 — verifies that consumeAgentStream correctly:
//   - dispatches one handler call per ExecutorEvent kind,
//   - handles partial frames straddling network-chunk boundaries,
//   - silently drops `: keepalive\n\n` comment frames,
//   - surfaces transport-only events (plan-cancelled, validation-complete).

import { describe, expect, it, vi } from 'vitest';
import { type AgentStreamHandlers, consumeAgentStream } from './streaming-consumer.js';

function responseOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
  // biome-ignore lint/suspicious/noExplicitAny: minimal Response shape — only body + headers are read
  return new Response(stream as any);
}

const frame = (kind: string, data: object, id: number) =>
  `id: ${id}\nevent: ${kind}\ndata: ${JSON.stringify({ kind, ...data })}\n\n`;

describe('consumeAgentStream', () => {
  it('dispatches one handler call per event kind in order', async () => {
    const onStepStart = vi.fn();
    const onToolCall = vi.fn();
    const onPlanEnd = vi.fn();
    const onValidationComplete = vi.fn();
    const onAny = vi.fn();
    const text = [
      frame('step-start', { stepId: 's1' }, 0),
      frame('tool-call', { stepId: 's1', name: 'create_slide', args: {} }, 1),
      frame('plan-end', { finalDocument: { id: 'd' } }, 2),
      frame(
        'validation-complete',
        { validation: { tier: 'pass', programmatic: [], qualitative: [] } },
        3,
      ),
    ].join('');
    await consumeAgentStream(responseOf([text]), {
      onStepStart,
      onToolCall,
      onPlanEnd,
      onValidationComplete,
      onAny,
    });
    expect(onStepStart).toHaveBeenCalledTimes(1);
    expect(onToolCall).toHaveBeenCalledTimes(1);
    expect(onPlanEnd).toHaveBeenCalledTimes(1);
    expect(onValidationComplete).toHaveBeenCalledTimes(1);
    expect(onAny).toHaveBeenCalledTimes(4);
  });

  it('handles a frame split across two network chunks', async () => {
    const full = frame('step-start', { stepId: 's1' }, 0);
    // Split mid-data so the consumer must buffer.
    const split = Math.floor(full.length / 2);
    const onStepStart = vi.fn();
    await consumeAgentStream(responseOf([full.slice(0, split), full.slice(split)]), {
      onStepStart,
    });
    expect(onStepStart).toHaveBeenCalledTimes(1);
  });

  it('silently drops `: keepalive` comment frames', async () => {
    const onAny = vi.fn();
    const text = `: keepalive\n\n${frame('step-start', { stepId: 's' }, 0)}: another\n\n`;
    await consumeAgentStream(responseOf([text]), { onAny });
    // Only the real event reaches onAny; both comment frames drop.
    expect(onAny).toHaveBeenCalledTimes(1);
  });

  it('routes the plan-cancelled sentinel to onCancelled', async () => {
    const onCancelled = vi.fn();
    const text = `id: 0\nevent: plan-cancelled\ndata: ${JSON.stringify({ kind: 'plan-cancelled', reason: 'aborted' })}\n\n`;
    await consumeAgentStream(responseOf([text]), { onCancelled });
    expect(onCancelled).toHaveBeenCalledWith({ kind: 'plan-cancelled', reason: 'aborted' });
  });

  it('throws when Response has no body', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: forcing the no-body path
    await expect(consumeAgentStream({ body: null } as any, {})).rejects.toThrow(/no body/);
  });

  it('handles a final frame missing the trailing blank line', async () => {
    const handlers: AgentStreamHandlers = { onStepStart: vi.fn() };
    const text = 'id: 0\nevent: step-start\ndata: {"kind":"step-start","stepId":"s"}';
    await consumeAgentStream(responseOf([text]), handlers);
    expect(handlers.onStepStart).toHaveBeenCalledTimes(1);
  });
});
