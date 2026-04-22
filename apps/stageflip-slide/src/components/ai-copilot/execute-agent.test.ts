// apps/stageflip-slide/src/components/ai-copilot/execute-agent.test.ts
// Contract tests for the agent-execute fetch wrapper. Uses the `fetchImpl`
// seam rather than monkey-patching global.fetch.

import { describe, expect, it, vi } from 'vitest';
import { executeAgent } from './execute-agent';

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('executeAgent', () => {
  it('maps a 501 with a non-JSON body to { kind: "error" } so gateway crashes do not masquerade as pending', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('<html>gateway boom</html>', { status: 501 }));
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result.kind).toBe('error');
  });

  it('maps a 501 response to { kind: "pending" }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(501, {
        error: 'not_implemented',
        message: 'Agent execute is wired by Phase 7; the walking skeleton stubs this route.',
        phase: 'phase-7',
      }),
    );
    const result = await executeAgent({ prompt: 'anything', fetchImpl });
    expect(result.kind).toBe('pending');
    if (result.kind === 'pending') {
      expect(result.phase).toBe('phase-7');
      expect(result.message).toMatch(/Phase 7/);
    }
  });

  it('maps a 2xx response to { kind: "applied" }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { message: 'ok' }));
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result).toEqual({ kind: 'applied', message: 'ok' });
  });

  it('maps a non-ok, non-501 response to { kind: "error" }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { message: 'boom' }));
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result).toEqual({ kind: 'error', message: 'boom' });
  });

  it('maps a fetch reject to { kind: "error" } with the thrown message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result).toEqual({ kind: 'error', message: 'offline' });
  });

  it('POSTs the prompt as JSON to the canonical route', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(501, { phase: 'phase-7' }));
    await executeAgent({ prompt: 'Add a slide', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/agent/execute');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'Add a slide' });
  });

  it('forwards an AbortSignal when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(501, {}));
    const controller = new AbortController();
    await executeAgent({ prompt: 'x', signal: controller.signal, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
