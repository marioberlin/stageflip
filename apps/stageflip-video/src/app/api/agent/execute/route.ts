// apps/stageflip-video/src/app/api/agent/execute/route.ts
// Phase-8 walking-skeleton agent endpoint. Gives the AI copilot a stable
// URL to aim at before the real video orchestrator lands. Mirrors the
// pattern slide-app used during T-122 (501 + phase sentinel). T-187b/c
// will swap this for a real Planner/Executor/Validator pipeline, likely
// by lifting the slide-app's orchestrator into a shared app-agent
// package.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function POST(): Response {
  return NextResponse.json(
    {
      error: 'not_implemented',
      phase: 'phase-8',
      message:
        'StageFlip.Video agent endpoint is scaffolded but not yet wired to an orchestrator. Pending: T-187b (shared orchestrator lift) / T-187c (UI wiring).',
    },
    { status: 501 },
  );
}

export function GET(): Response {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
