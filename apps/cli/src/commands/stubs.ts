// apps/cli/src/commands/stubs.ts
// T-225 — every user-manual.md §4 command that isn't shipped end-to-end
// by Phase 10 ships as a stub. Stubs print a clear "not yet
// implemented" message + exit 1 so scripts fail fast; they still
// appear in `stageflip --help` and in the generated CLI-reference
// skill so docs + registry stay honest.

import type { CliRunContext } from '../types.js';

export function createStubRunner(name: string, plannedTask?: string) {
  return (ctx: CliRunContext): number => {
    const suffix = plannedTask ? ` (planned: ${plannedTask})` : '';
    ctx.env.error(`stageflip ${name}: not yet implemented${suffix}`);
    return 1;
  };
}
