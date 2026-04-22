// apps/stageflip-slide/src/app/api/agent/execute/route.ts
// Walking-skeleton agent endpoint. Phase 7 replaces the internals with
// real Planner → Executor → Validator orchestration; until then the
// route exists so every consumer has a stable URL to aim at and
// returns a structured 501 so client code can branch cleanly.

import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'not_implemented',
      message: 'Agent execute is wired by Phase 7; the walking skeleton stubs this route.',
      phase: 'phase-7',
    },
    { status: 501 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'Use POST to execute an agent tool call.',
    },
    { status: 405 },
  );
}
