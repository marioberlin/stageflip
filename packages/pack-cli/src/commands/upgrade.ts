// packages/pack-cli/src/commands/upgrade.ts
// T-540 — `stageflip-pack upgrade --target <version>` — walk every
// installed pack and report compatibility against a target engine
// version via `planUpgrade`. Exit code:
//   0  every pack is `compatible`
//   1  any pack is `needs-upgrade`, `blocked`, or
//      `manifest-version-incompatible`, OR the `--target` flag is missing.
//
// This command emits PLANS, not INSTALLS — it never touches the
// install root. The actual upgrade install flow is a separate concern
// (see install.ts stub).

import type { PackManifest } from '@stageflip/pack-format';
import {
  type PackUpgradeRow,
  type UpgradePlan,
  discoverPacks,
  isPackLoadFailure,
  planUpgrade,
} from '@stageflip/pack-loader';

import type { CliDependencies } from '../deps.js';

const USAGE = `stageflip-pack upgrade — plan an engine-version upgrade

USAGE
  stageflip-pack upgrade --target <version>

OPTIONS
  --target <version>   Target engine version to plan against (required).

EXIT CODES
  0   every installed pack is compatible with the target.
  1   at least one pack needs upgrade, is blocked, or has an unreadable
      manifestVersion; OR the --target flag is missing.
`;

/**
 * Run the `upgrade` subcommand. Parses `--target <version>` from
 * `args`, walks installed packs, calls `planUpgrade`, prints a table.
 */
export async function runUpgrade(args: readonly string[], deps: CliDependencies): Promise<number> {
  const target = parseTargetFlag(args);
  if (target === null) {
    deps.logger.error('stageflip-pack upgrade: missing --target <version>');
    deps.logger.error(USAGE);
    return 1;
  }

  const discovered = await discoverPacks(deps.rootPath, deps.loader);
  const installed: { manifest: PackManifest; installPath: string }[] = [];
  for (const row of discovered) {
    if (isPackLoadFailure(row.result)) continue;
    installed.push({ manifest: row.result.manifest, installPath: row.result.installPath });
  }

  const plan = planUpgrade({ installed, targetEngineVersion: target });
  printPlan(plan, deps);

  if (plan.summary.compatible === plan.rows.length) {
    return 0;
  }
  return 1;
}

/**
 * Extract `--target <value>` from a flat argv. Returns `null` if not
 * present or if the value is missing.
 */
export function parseTargetFlag(args: readonly string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('-')) return null;
      return next;
    }
    if (arg?.startsWith('--target=')) {
      return arg.slice('--target='.length);
    }
  }
  return null;
}

/**
 * Print the plan as a fixed-column table followed by a summary line.
 * The CliLogger is line-oriented, so each row is one `info` call.
 */
function printPlan(plan: UpgradePlan, deps: CliDependencies): void {
  if (plan.rows.length === 0) {
    deps.logger.info(`(no installed packs to check against engine ${plan.targetEngineVersion})`);
    return;
  }
  deps.logger.info(`Target engine: ${plan.targetEngineVersion}`);
  deps.logger.info(formatHeader());
  for (const row of plan.rows) {
    deps.logger.info(formatRow(row));
  }
  deps.logger.info(
    `Summary: ${plan.summary.compatible} compatible, ${plan.summary.needsUpgrade} needs-upgrade, ${plan.summary.blocked} blocked, ${plan.summary.manifestVersionIncompatible} manifest-version-incompatible`,
  );
}

function pad(s: string, n: number): string {
  if (s.length >= n) return `${s} `;
  return s + ' '.repeat(n - s.length);
}

/** Column widths chosen to keep typical pack-ids legible without truncating. */
const COL_PACK = 32;
const COL_VERSION = 10;
const COL_STATUS = 30;

/** Format the table header. Exposed so tests can assert against it. */
export function formatHeader(): string {
  return `${pad('Pack', COL_PACK)}${pad('Current', COL_VERSION)}${pad('Status', COL_STATUS)}Action`;
}

/** Format one row. Exposed so tests can assert against it. */
export function formatRow(row: PackUpgradeRow): string {
  return (
    pad(`${row.publisherId}/${row.packId}`, COL_PACK) +
    pad(row.currentVersion, COL_VERSION) +
    pad(row.status, COL_STATUS) +
    row.recommendedAction
  );
}
