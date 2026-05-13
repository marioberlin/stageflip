// packages/pack-publish-cli/src/cli.ts
// T-500 — `stageflip-pack-publish` dispatcher. Maps argv[0] to a
// subcommand handler. Subcommands receive the rest of argv plus the
// shared dependency bundle; no command imports `process.*` directly.
//
// Exit codes:
//   0 — success / dry-run
//   1 — usage error or business-logic failure (validate fail, missing
//       inputs, signature mismatch, HTTP non-2xx, …)
//
// Determinism perimeter: this package lives OUTSIDE.

import { runPublish } from './commands/publish.js';
import { runSign } from './commands/sign.js';
import { runValidateCommand } from './commands/validate.js';
import type { CliPublishDependencies } from './deps.js';

const HELP_TEXT = `stageflip-pack-publish — publisher-side publishing tooling for .stageflip-pack archives

USAGE
  stageflip-pack-publish validate <pack-dir>
  stageflip-pack-publish sign <pack-dir> --key <private.pem> --out <archive-path>
  stageflip-pack-publish publish <archive-path> --registry <url> [--token <env-var-name>] [--publisher-key <pem-path>]
  stageflip-pack-publish --help

SUBCOMMANDS
  validate  Run T-499's pack-integrity invariants against an UNSIGNED
            pack source directory. Prints per-invariant pass/warn/fail.
            Exit 0 if no fails, 1 if any.
  sign      Wraps @stageflip/pack-signing's signPackDirectory with a
            pre-flight validate pass. Writes <archive-path> +
            <archive-path>.sig. Prints byte counts on success.
  publish   Verify a signed archive's signature against a publisher
            public key (optional in T-500), extract <pack-id>@<version>
            from the embedded manifest, and POST the payload to
            <registry-url>/api/v1/packs with Authorization: Bearer
            <env-var-value>. If --registry starts with dry-run:// the
            HTTP step is skipped and the intent is printed instead.
            Marketplace registry contract lands in T-536+; today this
            subcommand operates in dry-run mode for pipeline testing.

EXIT CODES
  0   success / dry-run
  1   usage error or business-logic failure
`;

/**
 * Main entry. Returns a numeric exit code; never calls `process.exit`
 * so tests can drive it directly. Unknown subcommands and `--help`
 * both route to the usage banner.
 */
export async function runPublishCli(
  argv: readonly string[],
  deps: CliPublishDependencies,
): Promise<number> {
  const sub = argv[0];
  if (sub === undefined || sub === '-h' || sub === '--help' || sub === 'help') {
    deps.logger.info(HELP_TEXT);
    return sub === undefined ? 1 : 0;
  }
  const rest = argv.slice(1);
  switch (sub) {
    case 'validate':
      return runValidateCommand(rest, deps);
    case 'sign':
      return runSign(rest, deps);
    case 'publish':
      return runPublish(rest, deps);
    default:
      deps.logger.error(`stageflip-pack-publish: unknown subcommand: ${sub}`);
      deps.logger.error(HELP_TEXT);
      return 1;
  }
}

/** Exported so `cli.test.ts` can assert the banner contents. */
export const HELP_BANNER = HELP_TEXT;
