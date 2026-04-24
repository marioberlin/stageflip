// apps/stageflip-slide/src/app/api/agent/execute/route.ts
// Phase-7 agent endpoint — wires Planner → Executor → Validator via the
// orchestrator module. Replaces the walking-skeleton 501 stub shipped in
// Phase 6; callers that previously received `phase: 'phase-7'` / 501 now
// receive a real orchestration result when `ANTHROPIC_API_KEY` is set.
// When the key is missing the route returns 503 `not_configured` — a
// distinct failure mode the UI can surface differently from the old
// 501 "not wired yet" message.

import { documentSchema } from '@stageflip/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OrchestratorNotConfigured, runAgent } from './orchestrator.js';

// Request body schema — strict, Zod-validated so untrusted payloads
// never reach the orchestrator without shape guarantees.
const executeRequestSchema = z
  .object({
    prompt: z.string().min(1).max(4000),
    document: documentSchema,
    selection: z
      .object({
        slideId: z.string().min(1).optional(),
        elementIds: z.array(z.string().min(1)),
      })
      .strict()
      .optional(),
    plannerModel: z.string().min(1).optional(),
    executorModel: z.string().min(1).optional(),
    validatorModel: z.string().min(1).optional(),
  })
  .strict();

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_json',
        message: 'Request body must be valid JSON.',
      },
      { status: 400 },
    );
  }

  const parsed = executeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_request',
        message: 'Request body failed schema validation.',
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    // `exactOptionalPropertyTypes` forbids passing `undefined` at callsites
    // where the field is optional. Zod's `.optional()` surfaces the field
    // as `T | undefined` in the parsed type, so we reconstruct the request
    // with only defined properties.
    const data = parsed.data;
    const request: Parameters<typeof runAgent>[0] = {
      prompt: data.prompt,
      document: data.document,
    };
    if (data.selection !== undefined) {
      request.selection = {
        elementIds: data.selection.elementIds,
        ...(data.selection.slideId !== undefined ? { slideId: data.selection.slideId } : {}),
      };
    }
    if (data.plannerModel !== undefined) request.plannerModel = data.plannerModel;
    if (data.executorModel !== undefined) request.executorModel = data.executorModel;
    if (data.validatorModel !== undefined) request.validatorModel = data.validatorModel;
    const result = await runAgent(request);
    return NextResponse.json(
      {
        ok: true,
        plan: result.plan,
        events: result.events,
        finalDocument: result.finalDocument,
        validation: result.validation,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof OrchestratorNotConfigured) {
      return NextResponse.json(
        {
          ok: false,
          error: 'not_configured',
          message: 'Agent orchestrator is not configured. Set ANTHROPIC_API_KEY and retry.',
          reason: err.reason,
        },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: 'orchestrator_failed', message }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: 'method_not_allowed',
      message: 'Use POST to execute an agent tool call.',
    },
    { status: 405 },
  );
}
