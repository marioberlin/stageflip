// scripts/backup-restore.ts
// T-272 — Interactive CLI helper for executing the restore runbook.
//
// Three modes:
//   --dry-run --target=<staging|prod> --backup-date=<YYYY-MM-DD>
//     Print the planned operations without executing.
//   --execute --target=staging --backup-date=<YYYY-MM-DD>
//     Run the staging restore. Requires --i-have-read-the-runbook.
//   --execute --target=prod  ...
//     Refuses unless --i-have-read-the-runbook AND a manual confirmation
//     prompt is answered ("yes"). Tests pass `confirmPrompt: () => 'yes'`.
//
// The CLI is a planning aid; the actual import operations are documented
// in docs/ops/restore-procedure.md and require gcloud / firebase CLI access
// the script does NOT bundle. The execute path here prints the canonical
// command sequence; operators run it under supervision.
//
// Exit codes:
//   0  — success (dry-run printed plan or execute completed planning)
//   1  — missing required argument
//   2  — invalid argument value
//   3  — execute mode invoked without --i-have-read-the-runbook
//   4  — execute against prod refused (operator did not confirm)

interface CliArgs {
  readonly mode: 'dry-run' | 'execute' | 'unset';
  readonly target: 'staging' | 'prod' | undefined;
  readonly backupDate: string | undefined;
  readonly confirmed: boolean;
  readonly scope: 'full' | 'firestore-only' | 'storage-only';
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseArgs(argv: readonly string[]): CliArgs {
  let mode: CliArgs['mode'] = 'unset';
  let target: CliArgs['target'];
  let backupDate: string | undefined;
  let confirmed = false;
  let scope: CliArgs['scope'] = 'full';
  for (const arg of argv) {
    if (arg === '--dry-run') {
      mode = 'dry-run';
    } else if (arg === '--execute') {
      mode = 'execute';
    } else if (arg.startsWith('--target=')) {
      const v = arg.slice('--target='.length);
      if (v === 'staging' || v === 'prod') {
        target = v;
      } else {
        throw new Error(`--target must be "staging" or "prod"; got "${v}"`);
      }
    } else if (arg.startsWith('--backup-date=')) {
      const v = arg.slice('--backup-date='.length);
      if (!ISO_DATE_RE.test(v)) {
        throw new Error(`--backup-date must be YYYY-MM-DD; got "${v}"`);
      }
      backupDate = v;
    } else if (arg === '--i-have-read-the-runbook') {
      confirmed = true;
    } else if (arg.startsWith('--scope=')) {
      const v = arg.slice('--scope='.length);
      if (v === 'full' || v === 'firestore-only' || v === 'storage-only') {
        scope = v;
      } else {
        throw new Error(`--scope must be "full" | "firestore-only" | "storage-only"; got "${v}"`);
      }
    }
  }
  return { mode, target, backupDate, confirmed, scope };
}

interface PlanLine {
  readonly description: string;
  readonly command: string;
}

function buildPlan(args: {
  target: 'staging' | 'prod';
  backupDate: string;
  scope: 'full' | 'firestore-only' | 'storage-only';
}): PlanLine[] {
  const projectId = args.target === 'staging' ? 'stageflip-staging' : 'stageflip';
  const backupsBucket =
    args.target === 'staging' ? 'stageflip-backups-staging' : 'stageflip-backups';
  const lines: PlanLine[] = [];

  if (args.scope === 'full' || args.scope === 'firestore-only') {
    lines.push({
      description: `Import (default) Firestore from ${args.backupDate} backup`,
      command:
        `gcloud firestore import gs://${backupsBucket}/firestore/us/${args.backupDate} ` +
        `--project=${projectId} --database='(default)'`,
    });
    lines.push({
      description: `Import eu-west Firestore from ${args.backupDate} backup`,
      command:
        `gcloud firestore import gs://${backupsBucket}/firestore/eu/${args.backupDate} ` +
        `--project=${projectId} --database='eu-west'`,
    });
  }

  if (args.scope === 'full' || args.scope === 'storage-only') {
    lines.push({
      description: `Mirror US assets from ${args.backupDate} backup to assets bucket`,
      command:
        `gsutil -m rsync -r gs://${backupsBucket}/storage/${projectId}.appspot.com/${args.backupDate}/ ` +
        `gs://${projectId}.appspot.com/`,
    });
    lines.push({
      description: `Mirror EU assets from ${args.backupDate} backup to assets bucket`,
      command:
        `gsutil -m rsync -r gs://${backupsBucket}/storage/${projectId}-eu-assets/${args.backupDate}/ ` +
        `gs://${projectId}-eu-assets/`,
    });
  }

  // Verification step.
  lines.push({
    description: 'Verify document counts post-import (sanity check)',
    command:
      `firebase firestore:databases:list --project=${projectId} && ` +
      `gsutil du -sh gs://${projectId}.appspot.com/ gs://${projectId}-eu-assets/`,
  });

  return lines;
}

export interface RunOptions {
  readonly stdout?: NodeJS.WritableStream;
  readonly stderr?: NodeJS.WritableStream;
  /** Inject a confirmation prompt — tests pass () => 'yes'. */
  readonly confirmPrompt?: () => string;
}

function write(stream: NodeJS.WritableStream | undefined, text: string): void {
  (stream ?? process.stdout).write(text);
}

export function run(argv: readonly string[], options: RunOptions = {}): number {
  const stdout = options.stdout;
  const stderr = options.stderr ?? process.stderr;
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    write(stderr, `error: ${(err as Error).message}\n`);
    return 2;
  }

  if (args.mode === 'unset' || !args.target || !args.backupDate) {
    write(
      stderr,
      [
        'error: --dry-run | --execute, --target=<staging|prod>, --backup-date=<YYYY-MM-DD> are required.',
        'usage:',
        '  pnpm tsx scripts/backup-restore.ts \\',
        '    --dry-run --target=staging --backup-date=2026-04-28',
        '  pnpm tsx scripts/backup-restore.ts \\',
        '    --execute --target=staging --backup-date=2026-04-28 \\',
        '    --i-have-read-the-runbook',
        'see docs/ops/restore-procedure.md before running --execute.',
        '',
      ].join('\n'),
    );
    return 1;
  }

  const plan = buildPlan({
    target: args.target,
    backupDate: args.backupDate,
    scope: args.scope,
  });

  if (args.mode === 'dry-run') {
    write(
      stdout,
      `# Restore plan — DRY RUN\ntarget: ${args.target}\nbackup-date: ${args.backupDate}\nscope: ${args.scope}\n\n`,
    );
    for (const [i, line] of plan.entries()) {
      write(stdout, `${i + 1}. ${line.description}\n   $ ${line.command}\n`);
    }
    write(
      stdout,
      '\nRun with --execute --i-have-read-the-runbook to print the plan as an\n' +
        'executable shell script (operator pipes to bash under supervision).\n',
    );
    return 0;
  }

  // execute mode
  if (!args.confirmed) {
    write(
      stderr,
      'error: restore is high-stakes. Re-run with --i-have-read-the-runbook\n' +
        '       AFTER reading docs/ops/restore-procedure.md end-to-end.\n',
    );
    return 3;
  }

  if (args.target === 'prod') {
    const prompt = options.confirmPrompt ?? (() => '');
    const answer = prompt().trim().toLowerCase();
    if (answer !== 'yes') {
      write(
        stderr,
        `error: prod restore requires interactive confirmation (typed "yes"); got "${answer}".\n       Aborting. Run with --target=staging to drill the procedure first.\n`,
      );
      return 4;
    }
  }

  write(stdout, '#!/usr/bin/env bash\n');
  write(stdout, `# Restore script — target=${args.target} backup-date=${args.backupDate}\n`);
  write(stdout, '# Generated by scripts/backup-restore.ts. Review BEFORE piping to bash.\n');
  write(stdout, 'set -euo pipefail\n\n');
  for (const [i, line] of plan.entries()) {
    write(stdout, `# ${i + 1}. ${line.description}\n${line.command}\n\n`);
  }
  write(stdout, '# done.\n');
  return 0;
}

// Entry-point guard: only invoke run() when executed directly via `tsx` /
// `node`, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(run(process.argv.slice(2)));
}
