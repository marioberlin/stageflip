// packages/pack-cli/src/cli.ts
// T-497 — `stageflip-pack` dispatcher. Maps argv[0] to a subcommand
// handler. Subcommands receive the rest of argv plus the shared
// dependency bundle; no command imports `process.*` or `node:fs`
// directly.
//
// Exit codes:
//   0 — success
//   1 — business-logic failure (gate fail, pack not found, abort)
//   2 — not-yet-implemented (install) or usage error
//
// Determinism perimeter: this package lives OUTSIDE.

import { runInfo } from './commands/info.js';
import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runRemove } from './commands/remove.js';
import { runUpgrade } from './commands/upgrade.js';
import { runVerify } from './commands/verify.js';
import type { CliDependencies } from './deps.js';

const HELP_TEXT = `stageflip-pack — manage installed StageFlip packs

USAGE
  stageflip-pack list
  stageflip-pack info <pack-id>[@<version>]
  stageflip-pack verify [<pack-id>[@<version>]]
  stageflip-pack install <path-to-pack-tar>
  stageflip-pack remove <pack-id>[@<version>] [--yes]
  stageflip-pack upgrade --target <version>
  stageflip-pack --help

SUBCOMMANDS
  list      Enumerate every installed pack (id, version, publisher,
            license-kind, status).
  info      Print the full manifest + load status for one installed pack.
  verify    Re-run every install-time gate. Exit 1 if any pack failed.
  install   STUB in T-497 — prints a message and exits 2. Extract the tar
            manually into <root>/<publisher>/<id>/<version>/ for now.
  remove    Delete the install directory for one pack. Confirms via stdin
            unless --yes / -y.
  upgrade   Plan an engine-version upgrade. Walks installed packs and
            reports per-pack status against --target. Exit 1 if any pack
            is not compatible.

EXIT CODES
  0   success
  1   business-logic failure (gate fail, pack not found, user aborted)
  2   not-yet-implemented (install) or usage error
`;

/**
 * Main entry. Returns a numeric exit code; never calls `process.exit`
 * so tests can drive it directly. Unknown subcommands and `--help`
 * both route to the usage banner.
 */
export async function runCli(argv: readonly string[], deps: CliDependencies): Promise<number> {
  const sub = argv[0];
  if (sub === undefined || sub === '-h' || sub === '--help' || sub === 'help') {
    deps.logger.info(HELP_TEXT);
    return sub === undefined ? 1 : 0;
  }
  const rest = argv.slice(1);
  switch (sub) {
    case 'list':
      return runList(deps);
    case 'info':
      return runInfo(rest, deps);
    case 'verify':
      return runVerify(rest, deps);
    case 'install':
      return runInstall(rest, deps);
    case 'remove':
      return runRemove(rest, deps);
    case 'upgrade':
      return runUpgrade(rest, deps);
    default:
      deps.logger.error(`stageflip-pack: unknown subcommand: ${sub}`);
      deps.logger.error(HELP_TEXT);
      return 1;
  }
}

/** Exported so `cli.test.ts` can assert the banner contents. */
export const HELP_BANNER = HELP_TEXT;
