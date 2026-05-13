// packages/pack-signing/src/cli.ts
// T-498 — `stageflip-pack-sign` dispatcher. Maps argv[0] to a
// subcommand handler. No command imports `process.*` or `node:fs`
// directly; everything routes via `CliSignDependencies`.
//
// Exit codes:
//   0 — success
//   1 — usage error or business-logic failure (signature mismatch,
//       missing inputs, refusal-to-overwrite, etc.)
//
// Determinism perimeter: this package lives OUTSIDE.

import { runGenerateKeysCommand } from './commands/generate-keys.js';
import { runSignCommand } from './commands/sign.js';
import { runVerifyCommand } from './commands/verify.js';
import type { CliSignDependencies } from './deps.js';

const HELP_TEXT = `stageflip-pack-sign — publisher-side signing tooling for .stageflip-pack archives

USAGE
  stageflip-pack-sign generate-keys --out-dir <dir> [--force]
  stageflip-pack-sign sign <pack-dir> --key <private.pem> --out <archive-path>
  stageflip-pack-sign verify <archive-path> --key <public.pem>
  stageflip-pack-sign --help

SUBCOMMANDS
  generate-keys  Generate a fresh Ed25519 keypair (publisher.private.pem +
                 publisher.public.pem) into <dir>. Refuses to overwrite
                 existing files unless --force.
  sign           Read all files under <pack-dir>, build a deterministic
                 archive, write it to <archive-path>, sign with Ed25519,
                 write <archive-path>.sig (raw 64-byte signature).
                 Patches manifest.json's integrity.hash to match.
  verify         Read <archive-path> + <archive-path>.sig + <public.pem>,
                 verify the Ed25519 signature. Prints \`verified\` (exit 0)
                 or the failure detail (exit 1).

EXIT CODES
  0   success
  1   usage error or business-logic failure
`;

/**
 * Main entry. Returns a numeric exit code; never calls `process.exit`
 * so tests can drive it directly. Unknown subcommands and `--help`
 * both route to the usage banner.
 */
export async function runSignCli(
  argv: readonly string[],
  deps: CliSignDependencies,
): Promise<number> {
  const sub = argv[0];
  if (sub === undefined || sub === '-h' || sub === '--help' || sub === 'help') {
    deps.logger.info(HELP_TEXT);
    return sub === undefined ? 1 : 0;
  }
  const rest = argv.slice(1);
  switch (sub) {
    case 'generate-keys':
      return runGenerateKeysCommand(rest, deps);
    case 'sign':
      return runSignCommand(rest, deps);
    case 'verify':
      return runVerifyCommand(rest, deps);
    default:
      deps.logger.error(`stageflip-pack-sign: unknown subcommand: ${sub}`);
      deps.logger.error(HELP_TEXT);
      return 1;
  }
}

/** Exported so `cli.test.ts` can assert the banner contents. */
export const HELP_BANNER = HELP_TEXT;
