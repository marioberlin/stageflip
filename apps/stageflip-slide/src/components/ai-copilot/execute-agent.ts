// apps/stageflip-slide/src/components/ai-copilot/execute-agent.ts
// Thin fetch wrapper around /api/agent/execute. Phase 7 returns real
// orchestrator results on success; the route still distinguishes
// `not_configured` (503 — API key missing) from transport errors so
// the UI can surface a configuration hint separately.

/**
 * Result discriminator:
 *   - `applied`       — orchestrator ran and returned a result.
 *   - `not_configured`— 503 from the route: ANTHROPIC_API_KEY is unset.
 *   - `pending`       — legacy 501 `phase-7` path, retained for
 *                       backwards compatibility with any clients still
 *                       talking to a pre-T-170 build.
 *   - `error`         — 4xx / 5xx / network error the route didn't
 *                       explicitly classify.
 */
export type AgentExecuteResult =
  | { kind: 'applied'; message: string; payload: AgentExecutePayload }
  | { kind: 'not_configured'; message: string }
  | { kind: 'pending'; message: string; phase: string }
  | { kind: 'error'; message: string };

/** Minimal shape the UI consumes; extend as more fields become useful. */
export interface AgentExecutePayload {
  plan: unknown;
  events: unknown[] | undefined;
  finalDocument: unknown;
  validation: unknown;
}

export interface ExecuteAgentArgs {
  prompt: string;
  document?: unknown;
  selection?: { slideId?: string; elementIds: string[] };
  signal?: AbortSignal;
  /** Test seam — lets specs inject a fetch fake without patching globals. */
  fetchImpl?: typeof fetch;
}

export async function executeAgent({
  prompt,
  document,
  selection,
  signal,
  fetchImpl = fetch,
}: ExecuteAgentArgs): Promise<AgentExecuteResult> {
  const body: Record<string, unknown> = { prompt };
  if (document !== undefined) body.document = document;
  if (selection !== undefined) body.selection = selection;

  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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

  let payload:
    | {
        ok?: boolean;
        error?: string;
        message?: string;
        phase?: string;
        plan?: unknown;
        events?: unknown[];
        finalDocument?: unknown;
        validation?: unknown;
      }
    | undefined;
  let payloadOk = true;
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Non-JSON body (e.g. upstream gateway crash). Treat as opaque error.
    payloadOk = false;
  }

  if (!payloadOk || payload === undefined) {
    return {
      kind: 'error',
      message: `Request failed (${response.status}; non-JSON body).`,
    };
  }

  // 503 — new Phase-7 "not configured" signal.
  if (response.status === 503 && payload.error === 'not_configured') {
    return {
      kind: 'not_configured',
      message: payload.message ?? 'Agent is not configured.',
    };
  }

  // Legacy 501 — pre-T-170 builds.
  if (response.status === 501) {
    return {
      kind: 'pending',
      message: payload.message ?? 'Agent is not wired yet.',
      phase: payload.phase ?? 'unknown',
    };
  }

  if (response.ok && payload.ok === true) {
    return {
      kind: 'applied',
      message: 'Applied.',
      payload: {
        plan: payload.plan,
        events: payload.events,
        finalDocument: payload.finalDocument,
        validation: payload.validation,
      },
    };
  }

  return {
    kind: 'error',
    message: payload.message ?? `Request failed (${response.status}).`,
  };
}
