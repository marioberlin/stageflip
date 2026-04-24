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

  it('maps a legacy 501 response (pre-T-170 stub) to { kind: "pending" }', async () => {
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

  it('maps a 503 not_configured response to { kind: "not_configured" }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(503, {
        ok: false,
        error: 'not_configured',
        message: 'Agent orchestrator is not configured. Set ANTHROPIC_API_KEY and retry.',
        reason: 'missing_api_key',
      }),
    );
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result.kind).toBe('not_configured');
    if (result.kind === 'not_configured') {
      expect(result.message).toMatch(/ANTHROPIC_API_KEY/);
    }
  });

  it('maps a 200 ok=true response to { kind: "applied" } with the full payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        plan: { steps: [] },
        events: [],
        finalDocument: { meta: {} },
        validation: { tier: 'pass', programmatic: [], qualitative: [] },
      }),
    );
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') {
      expect(result.payload.plan).toEqual({ steps: [] });
      expect(result.payload.events).toEqual([]);
      expect(result.payload.finalDocument).toEqual({ meta: {} });
      expect(result.payload.validation).toMatchObject({ tier: 'pass' });
    }
  });

  it('maps a non-ok, non-501/503 response to { kind: "error" }', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { ok: false, message: 'boom' }));
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result).toEqual({ kind: 'error', message: 'boom' });
  });

  it('maps a fetch reject to { kind: "error" } with the thrown message', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await executeAgent({ prompt: 'x', fetchImpl });
    expect(result).toEqual({ kind: 'error', message: 'offline' });
  });

  it('POSTs the prompt (+ optional document/selection) as JSON to the canonical route', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(501, { phase: 'phase-7' }));
    await executeAgent({
      prompt: 'Add a slide',
      document: { meta: {} },
      selection: { elementIds: ['el-1'] },
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/agent/execute');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      prompt: 'Add a slide',
      document: { meta: {} },
      selection: { elementIds: ['el-1'] },
    });
  });

  it('omits document + selection when not provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(501, { phase: 'phase-7' }));
    await executeAgent({ prompt: 'x', fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ prompt: 'x' });
  });

  it('forwards an AbortSignal when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(501, {}));
    const controller = new AbortController();
    await executeAgent({ prompt: 'x', signal: controller.signal, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
