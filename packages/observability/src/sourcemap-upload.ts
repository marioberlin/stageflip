// packages/observability/src/sourcemap-upload.ts
// Pure-logic core for `scripts/sentry-upload-sourcemaps.ts` per D-T264-5.
// Lives in this package (not directly under `scripts/`) so it ships under
// vitest coverage with the rest of @stageflip/observability. The script-level
// file at `scripts/sentry-upload-sourcemaps.ts` is a thin shim.

import { spawnSync } from 'node:child_process';

/** Parsed CLI args. */
export interface ParsedArgs {
  release?: string;
  org?: string;
  project?: string;
  path?: string;
  dryRun: boolean;
  help: boolean;
}

export const USAGE = `Usage: tsx scripts/sentry-upload-sourcemaps.ts \\
  --release=<git-sha> --org=<sentry-org> --project=<sentry-project> --path=<dir> [--dry-run]

Required:
  --release  Sentry release identifier (typically the git SHA).
  --org      Sentry organization slug.
  --project  Sentry project slug.
  --path     Directory containing the built JS + sourcemaps.

Optional:
  --dry-run  Print the Sentry CLI command that would be run; do not invoke.
  --help     Print this message.

Env:
  SENTRY_AUTH_TOKEN  Required (unless --dry-run) to authenticate the upload.
`;

/** Parse `--key=value` and `--flag` forms. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { dryRun: false, help: false };
  for (const a of argv) {
    if (a === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    const eq = a.indexOf('=');
    if (!a.startsWith('--') || eq === -1) continue;
    const key = a.slice(2, eq);
    const value = a.slice(eq + 1);
    switch (key) {
      case 'release':
        out.release = value;
        break;
      case 'org':
        out.org = value;
        break;
      case 'project':
        out.project = value;
        break;
      case 'path':
        out.path = value;
        break;
      default:
        break;
    }
  }
  return out;
}

/** Validate required args; return list of missing keys. */
export function validateArgs(args: ParsedArgs): readonly string[] {
  const missing: string[] = [];
  if (!args.release) missing.push('--release');
  if (!args.org) missing.push('--org');
  if (!args.project) missing.push('--project');
  if (!args.path) missing.push('--path');
  return missing;
}

/** Build the sentry-cli argv for the given inputs. */
export function buildSentryCliArgs(
  args: Required<Pick<ParsedArgs, 'release' | 'org' | 'project' | 'path'>>,
): readonly string[] {
  return [
    'sourcemaps',
    'upload',
    '--org',
    args.org,
    '--project',
    args.project,
    '--release',
    args.release,
    args.path,
  ];
}

/** Execute (or dry-run) the upload. The `invoke` injection point keeps tests offline. */
export interface RunOptions {
  readonly out: NodeJS.WritableStream;
  readonly err: NodeJS.WritableStream;
  readonly invoke?: (cmd: string, cliArgs: readonly string[]) => { status: number | null };
}

export function run(argv: readonly string[], opts: RunOptions): number {
  const args = parseArgs(argv);
  if (args.help) {
    opts.out.write(USAGE);
    return 0;
  }
  const missing = validateArgs(args);
  if (missing.length > 0) {
    opts.err.write(`sentry-upload-sourcemaps: missing required args: ${missing.join(', ')}\n`);
    opts.err.write(USAGE);
    return 1;
  }
  const cliArgs = buildSentryCliArgs({
    release: args.release as string,
    org: args.org as string,
    project: args.project as string,
    path: args.path as string,
  });
  if (args.dryRun) {
    opts.out.write(`[dry-run] sentry-cli ${cliArgs.join(' ')}\n`);
    return 0;
  }
  const invoke = opts.invoke ?? ((cmd, c) => spawnSync(cmd, [...c], { stdio: 'inherit' }));
  const result = invoke('sentry-cli', cliArgs);
  return result.status ?? 1;
}
