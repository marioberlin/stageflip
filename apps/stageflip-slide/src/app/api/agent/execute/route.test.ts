// @vitest-environment node
// apps/stageflip-slide/src/app/api/agent/execute/route.test.ts
// T-442 — pins the slide agent route's error-mapping branches AND the
// new SSE streaming branch. Happy-path orchestration runs behind an
// env guard tests don't set, so the integration path stays in the
// app-agent + agent unit suites; these tests cover the route shell:
// 400 (invalid JSON / invalid request), 405 (GET), 503 (not_configured)
// — for both the JSON and the SSE branch — plus the streaming response
// content-type contract.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@stageflip/app-agent', async () => {
  const actual = await vi.importActual<{
    OrchestratorNotConfigured: typeof import('@stageflip/app-agent').OrchestratorNotConfigured;
  }>('@stageflip/app-agent');
  return {
    OrchestratorNotConfigured: actual.OrchestratorNotConfigured,
    runAgent: vi.fn(async () => {
      throw new actual.OrchestratorNotConfigured('missing_api_key');
    }),
    streamAgent: vi.fn(async function* () {
      // First yield surfaces a configured stream; tests that want the
      // not_configured branch override this mock per-call.
      yield { kind: 'step-start', stepId: 's1' };
      yield { kind: 'step-end', stepId: 's1', status: 'ok' };
      yield {
        kind: 'plan-end',
        finalDocument: {
          meta: {
            id: 'd',
            version: 0,
            createdAt: '2026-05-11T00:00:00.000Z',
            updatedAt: '2026-05-11T00:00:00.000Z',
            locale: 'en',
            schemaVersion: 1,
          },
          theme: { tokens: {} },
          variables: {},
          components: {},
          masters: [],
          layouts: [],
          content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
        },
      };
    }),
  };
});

import { streamAgent } from '@stageflip/app-agent';
import { GET, POST } from './route.js';

function validDoc() {
  return {
    meta: {
      id: 'd',
      version: 0,
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
  };
}

function makeRequest(body: unknown, query?: string): Request {
  return new Request(`https://example.test/api/agent/execute${query ? `?${query}` : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/agent/execute (JSON branch)', () => {
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
    const res = await POST(makeRequest({ prompt: 'Generate a deck', document: validDoc() }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; reason?: string };
    expect(body.error).toBe('not_configured');
    expect(body.reason).toBe('missing_api_key');
  });
});

describe('POST /api/agent/execute?stream=true (SSE branch)', () => {
  it('rejects invalid JSON with 400 invalid_json on the streaming path too', async () => {
    const res = await POST(
      new Request('https://example.test/api/agent/execute?stream=true', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects bodies missing required fields with 400 invalid_request', async () => {
    const res = await POST(makeRequest({ prompt: 'hi' }, 'stream=true'));
    expect(res.status).toBe(400);
  });

  it('returns text/event-stream and emits SSE frames for each ExecutorEvent', async () => {
    const res = await POST(
      makeRequest({ prompt: 'Generate a deck', document: validDoc() }, 'stream=true'),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const text = await res.text();
    expect(text).toContain('event: step-start');
    expect(text).toContain('event: step-end');
    expect(text).toContain('event: plan-end');
    // Each frame terminates with the spec blank line.
    expect(text.endsWith('\n\n')).toBe(true);
  });

  it('surfaces OrchestratorNotConfigured as 503 not_configured on the SSE branch', async () => {
    const { OrchestratorNotConfigured } = await import('@stageflip/app-agent');
    vi.mocked(streamAgent).mockImplementationOnce(async function* notConfigured() {
      // First .next() rejects with OrchestratorNotConfigured before any
      // SSE frame is written, so the route falls through to the 503
      // JSON branch.
      throw new OrchestratorNotConfigured('missing_api_key');
      // biome-ignore lint/correctness/noUnreachable: yield kept so TS sees an AsyncGenerator return type
      yield { kind: 'step-start', stepId: 's' };
    } as unknown as typeof streamAgent);
    const res = await POST(
      makeRequest({ prompt: 'Generate a deck', document: validDoc() }, 'stream=true'),
    );
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
