// @vitest-environment node
// apps/stageflip-display/src/app/api/agent/execute/route.test.ts
// T-207 — verifies the display agent route's error-mapping contract.
// Happy-path orchestration runs behind an env guard that tests don't
// set, so the integration path is covered by the slide-app + app-agent
// smoke tests; these tests pin the 400/405/503 branches.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@stageflip/app-agent', async () => {
  const { OrchestratorNotConfigured: RealNotConfigured } = await vi.importActual<{
    OrchestratorNotConfigured: typeof import('@stageflip/app-agent').OrchestratorNotConfigured;
  }>('@stageflip/app-agent');
  return {
    OrchestratorNotConfigured: RealNotConfigured,
    runAgent: vi.fn(async () => {
      throw new RealNotConfigured('missing_api_key');
    }),
  };
});

import { GET, POST } from './route.js';

function makeRequest(body: unknown): Request {
  return new Request('https://example.test/api/agent/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/agent/execute', () => {
  it('rejects invalid JSON with 400 invalid_json', async () => {
    const res = await POST(
      new Request('https://example.test/api/agent/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json at all',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_json');
  });

  it('rejects bodies missing required fields with 400 invalid_request', async () => {
    const res = await POST(makeRequest({ prompt: 'hi' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_request');
  });

  it('surfaces OrchestratorNotConfigured as 503 not_configured', async () => {
    const req = makeRequest({
      prompt: 'Generate a sale banner',
      document: {
        meta: {
          id: 'd',
          version: 0,
          createdAt: '2026-04-24T00:00:00.000Z',
          updatedAt: '2026-04-24T00:00:00.000Z',
          locale: 'en',
          schemaVersion: 1,
        },
        theme: { tokens: {} },
        variables: {},
        components: {},
        content: {
          mode: 'display',
          sizes: [{ id: 'mpu', width: 300, height: 250 }],
          durationMs: 15000,
          budget: {
            totalZipKb: 150,
            externalFontsAllowed: false,
            externalFontsKbCap: 0,
            assetsInlined: true,
          },
          elements: [],
        },
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; reason?: string };
    expect(body.error).toBe('not_configured');
    expect(body.reason).toBe('missing_api_key');
  });
});

describe('GET /api/agent/execute', () => {
  it('returns 405 method_not_allowed', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('method_not_allowed');
  });
});
