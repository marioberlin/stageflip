// packages/pack-cli/src/commands/install.ts
// T-497 — `stageflip-pack install <path-to-pack.tar>` — STUB MODE.
//
// The full implementation needs streaming tar + zstd extraction plus
// canonical-layout placement (`<root>/<publisher>/<id>/<version>/`).
// Both are deferred to a later task with a proper streaming dep
// selection (today's choice would lock in a binary-tar dep before the
// rest of the platform agrees on one). For T-497, this command emits
// a clear `not yet implemented` message and exits with code 2 so the
// operator knows to extract manually.

import type { CliDependencies } from '../deps.js';

/**
 * Run the `install` subcommand. Always exits 2 in stub mode; the
 * argument is recorded in the error message so logs make clear which
 * pack was attempted.
 */
export async function runInstall(args: readonly string[], deps: CliDependencies): Promise<number> {
  // Touch the args so logs/instrumentation could see them later.
  const target = args[0];
  if (target === undefined) {
    deps.logger.error('stageflip-pack install: missing <path-to-pack-tar> argument');
    return 2;
  }
  deps.logger.error(
    `stageflip-pack install: not yet implemented; extract ${target} manually under ${deps.rootPath}/<publisher>/<id>/<version>/ for now`,
  );
  return 2;
}
