// apps/stageflip-slide/src/components/ai-copilot/execute-agent.ts
// Thin fetch wrapper around the walking-skeleton /api/agent/execute
// endpoint. Returns a typed result so UI code branches on one discriminated
// union rather than raw Response inspection.

/**
 * Phase 6 contract: the route always returns 501 `not_implemented`. Phase 7
 * replaces the handler with a real planner/executor/validator; the UI's
 * branching stays the same — the `phase` discriminator flips from
 * `phase-7` to `ready` and the `message` string is replaced by a streamed
 * tool-call log. The response shape is deliberately narrow so Phase 7 can
 * extend it additively (add fields under `streamEvents`, `diff`, etc.)
 * without rewriting every call site.
 */
export type AgentExecuteResult =
  | { kind: 'pending'; message: string; phase: string }
  | { kind: 'applied'; message: string }
  | { kind: 'error'; message: string };

export interface ExecuteAgentArgs {
  prompt: string;
  signal?: AbortSignal;
  /** Test seam — lets specs inject a fetch fake without patching globals. */
  fetchImpl?: typeof fetch;
}

export async function executeAgent({
  prompt,
  signal,
  fetchImpl = fetch,
}: ExecuteAgentArgs): Promise<AgentExecuteResult> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  };
  if (signal) init.signal = signal;

  let response: Response;
  try {
    response = await fetchImpl('/api/agent/execute', init);
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'network error',
    };
  }

  let payload: { error?: string; message?: string; phase?: string } = {};
  let payloadOk = true;
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Non-JSON body (e.g. upstream gateway crash with 501 text). We can't
    // trust the status alone — surface it as an error rather than letting
    // a malformed 501 masquerade as the Phase 6 "not wired" placeholder.
    payloadOk = false;
  }

  if (response.status === 501 && payloadOk) {
    return {
      kind: 'pending',
      message: payload.message ?? 'Agent is not wired yet.',
      phase: payload.phase ?? 'unknown',
    };
  }

  if (response.ok && payloadOk) {
    return { kind: 'applied', message: payload.message ?? 'Applied.' };
  }

  return {
    kind: 'error',
    message: payload.message ?? `Request failed (${response.status}).`,
  };
}
