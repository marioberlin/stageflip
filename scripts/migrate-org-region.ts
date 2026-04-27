// scripts/migrate-org-region.ts
// T-271 — Skeleton for the manual org-region migration procedure. NOT
// productized: cross-region migration is rare (driven by legal triggers) and
// high-stakes (read-only window for the customer; user-record fan-out across
// `users/{userId}.orgs` references). The skeleton documents the planned
// operations under `--dry-run` and refuses to execute without explicit
// confirmation flags. Operators run it manually under supervision per
// `docs/ops/data-residency.md`.
//
// Usage:
//   pnpm tsx scripts/migrate-org-region.ts \
//     --dry-run \
//     --org=<orgId> \
//     --target-region=<eu|us>
//
// Exit codes:
//   0  — dry-run printed plan successfully
//   1  — missing required argument
//   2  — invalid argument value
//   3  — execute mode invoked without --i-have-read-the-runbook (intentional)

interface CliArgs {
  readonly dryRun: boolean;
  readonly org: string | undefined;
  readonly targetRegion: 'us' | 'eu' | undefined;
  readonly confirmed: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let org: string | undefined;
  let targetRegion: 'us' | 'eu' | undefined;
  let confirmed = false;
  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--org=')) {
      org = arg.slice('--org='.length);
    } else if (arg.startsWith('--target-region=')) {
      const v = arg.slice('--target-region='.length);
      if (v === 'us' || v === 'eu') {
        targetRegion = v;
      } else {
        throw new Error(`--target-region must be "us" or "eu"; got "${v}"`);
      }
    } else if (arg === '--i-have-read-the-runbook') {
      confirmed = true;
    }
  }
  return { dryRun, org, targetRegion, confirmed };
}

function printPlan(args: { org: string; targetRegion: 'us' | 'eu' }): void {
  const { org, targetRegion } = args;
  const sourceRegion = targetRegion === 'eu' ? 'us' : 'eu';
  const lines = [
    `# Org-region migration plan — DRY RUN`,
    `org: ${org}`,
    `source region: ${sourceRegion}`,
    `target region: ${targetRegion}`,
    ``,
    `Planned operations (NOT executed under --dry-run):`,
    `  1. Snapshot orgs/${org} + all subcollections from the ${sourceRegion} database.`,
    `  2. Set the org to read-only in the source region (write a maintenance flag).`,
    `  3. Bulk-import the snapshot into the ${targetRegion} database.`,
    `  4. Verify document count parity between source and target.`,
    `  5. Update users/{userId}.orgs[*] references that point at this org's region.`,
    `  6. Flip orgs/${org}.region in the target database to '${targetRegion}'.`,
    `     NOTE: validateRegionTransition would block this in normal application code;`,
    `     the migration runs as the admin SDK and bypasses both rules and the`,
    `     application-side guard. This is the documented escape hatch.`,
    `  7. Tombstone the source-region copy with a 30-day soft-delete window.`,
    `  8. Notify the customer that the migration is complete; lift the read-only flag.`,
    ``,
    `See docs/ops/data-residency.md for the full procedure, rollback plan, and`,
    `customer-comms template.`,
  ];
  for (const line of lines) {
    process.stdout.write(`${line}\n`);
  }
}

export function run(argv: readonly string[]): number {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 2;
  }

  if (!args.org || !args.targetRegion) {
    process.stderr.write(
      'error: --org=<orgId> and --target-region=<us|eu> are required.\n' +
        '       Run with --dry-run to preview the planned operations.\n',
    );
    return 1;
  }

  if (args.dryRun) {
    printPlan({ org: args.org, targetRegion: args.targetRegion });
    return 0;
  }

  if (!args.confirmed) {
    process.stderr.write(
      'error: cross-region migration is high-stakes. Re-run with both\n' +
        '       --dry-run (to preview) AND, when ready, --i-have-read-the-runbook\n' +
        '       to execute. Per T-271 D-T271-3, the executable path is intentionally\n' +
        '       not productized in v1.\n',
    );
    return 3;
  }

  process.stderr.write(
    'error: execute path is not implemented. Follow the manual procedure\n' +
      '       in docs/ops/data-residency.md. This script is a planning aid.\n',
  );
  return 3;
}

// Entry-point guard: only invoke run() when executed directly via `tsx` /
// `node`, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(run(process.argv.slice(2)));
}
