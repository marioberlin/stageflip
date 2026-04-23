// packages/parity-cli/src/cli.ts
// `stageflip-parity` CLI — argv parsing + pretty output + exit
// codes. The heavy lifting lives in `scoreFixture`; this file is
// glue + operator ergonomics.
//
// Usage:
//   stageflip-parity [fixture.json ...]                      (score — default)
//   stageflip-parity --candidates <dir> [fixture.json]
//   stageflip-parity --fixtures-dir <dir>
//   stageflip-parity prime --reference-fixtures --out <dir>  (T-119b subcommand)
//   stageflip-parity report [fixture.json ...] --out <file>  (T-137 subcommand)
//   stageflip-parity --help
//
// Exit codes:
//   0 — every scored fixture passed / every primed fixture succeeded
//   1 — at least one fixture was scored and FAILED its thresholds
//   2 — usage / argument error (no fixtures found, bad flag, ...)

import { readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

import { type PrimeRunDeps, runPrime } from './prime-cli.js';
import { runReport } from './report-cli.js';
import { type FixtureScoreOutcome, outcomeIsFailure, scoreFixture } from './score-fixture.js';

export interface CliOptions {
  /** Explicit fixture file paths to score. */
  readonly fixtures: readonly string[];
  /** If set, score every `*.json` under this directory. */
  readonly fixturesDir?: string;
  /** Shared candidates directory (overrides the per-fixture default). */
  readonly candidatesDir?: string;
  readonly help: boolean;
}

const HELP_TEXT = `stageflip-parity — score fixture candidates against goldens

USAGE
  stageflip-parity [fixture.json ...]                      (score — default)
  stageflip-parity --fixtures-dir <dir>
  stageflip-parity --candidates <dir> [fixture.json]
  stageflip-parity prime --reference-fixtures --out <dir>  (T-119b)
  stageflip-parity report [fixture.json ...] --out <file>  (T-137)
  stageflip-parity --help

OPTIONS (score mode)
  --fixtures-dir <dir>   Score every *.json under <dir>.
  --candidates <dir>     Shared candidates directory. Defaults to
                         <fixture-dir>/candidates/<fixture-name>/.
  -h, --help             Print this message.

SUBCOMMANDS
  prime                  Render fixtures to golden PNGs. Run
                         \`stageflip-parity prime --help\` for usage.
  report                 Build an HTML visual-diff viewer (side-by-side /
                         slider / overlay-difference). Run
                         \`stageflip-parity report --help\` for usage.

EXIT CODES
  0  every scored fixture passed; skipped fixtures don't fail the run.
  1  at least one fixture was scored and FAILED its thresholds.
  2  usage / argument error (no fixtures, bad flag).
`;

/** Parse `argv` (after `node <script>`). Pure — no IO, no exits. */
export function parseArgs(argv: readonly string[]): CliOptions {
  const fixtures: string[] = [];
  let fixturesDir: string | undefined;
  let candidatesDir: string | undefined;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }
    if (arg === '--fixtures-dir') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--fixtures-dir requires an argument');
      fixturesDir = next;
      i++;
      continue;
    }
    if (arg === '--candidates') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--candidates requires an argument');
      candidatesDir = next;
      i++;
      continue;
    }
    if (arg?.startsWith('--')) {
      throw new Error(`unknown flag: ${arg}`);
    }
    if (arg !== undefined) fixtures.push(arg);
  }
  return {
    fixtures,
    help,
    ...(fixturesDir !== undefined ? { fixturesDir } : {}),
    ...(candidatesDir !== undefined ? { candidatesDir } : {}),
  };
}

/** Resolve the CLI's fixture list — explicit paths OR discovered under a dir. */
async function resolveFixtures(opts: CliOptions): Promise<string[]> {
  if (opts.fixtures.length > 0 && opts.fixturesDir !== undefined) {
    throw new Error('pass fixture paths OR --fixtures-dir, not both');
  }
  if (opts.fixturesDir !== undefined) {
    const entries = await readdir(opts.fixturesDir);
    return entries
      .filter((name) => extname(name) === '.json')
      .map((name) => join(opts.fixturesDir as string, name))
      .sort();
  }
  return [...opts.fixtures];
}

/** Shape of the console IO `runCli` writes to — injectable for tests. */
export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

const NODE_IO: CliIo = {
  stdout(line) {
    process.stdout.write(`${line}\n`);
  },
  stderr(line) {
    process.stderr.write(`${line}\n`);
  },
};

/**
 * Main entry. Returns a numeric exit code; never calls `process.exit`
 * so tests can drive it directly.
 *
 * When `argv[0] === 'prime'`, delegates to the prime subcommand. The
 * `primeDeps` hook lets the CLI entrypoint wire a real Puppeteer-backed
 * primer while tests inject a stub. If `primeDeps` is undefined and a
 * prime invocation arrives, the CLI errors cleanly rather than launching
 * Chrome from a unit test by accident.
 */
export async function runCli(
  argv: readonly string[],
  io: CliIo = NODE_IO,
  primeDeps?: PrimeRunDeps,
): Promise<number> {
  if (argv[0] === 'prime') {
    if (primeDeps === undefined) {
      io.stderr(
        'stageflip-parity: prime subcommand requires primeDeps (not wired; this is a programming error)',
      );
      return 2;
    }
    return runPrime(argv.slice(1), primeDeps, io);
  }
  if (argv[0] === 'report') {
    return runReport(argv.slice(1), io);
  }
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    io.stderr(`stageflip-parity: ${(err as Error).message}`);
    io.stderr(HELP_TEXT);
    return 2;
  }
  if (opts.help) {
    io.stdout(HELP_TEXT);
    return 0;
  }
  let fixtures: string[];
  try {
    fixtures = await resolveFixtures(opts);
  } catch (err) {
    io.stderr(`stageflip-parity: ${(err as Error).message}`);
    return 2;
  }
  if (fixtures.length === 0) {
    io.stderr(
      'stageflip-parity: no fixtures specified (pass one or more JSON paths, or --fixtures-dir)',
    );
    io.stderr(HELP_TEXT);
    return 2;
  }

  const outcomes: FixtureScoreOutcome[] = [];
  for (const path of fixtures) {
    const absolutePath = resolve(path);
    try {
      const outcome = await scoreFixture(absolutePath, {
        ...(opts.candidatesDir !== undefined ? { candidatesDir: opts.candidatesDir } : {}),
      });
      outcomes.push(outcome);
      io.stdout(formatOutcome(outcome));
    } catch (err) {
      io.stderr(`stageflip-parity: ${path} — ${(err as Error).message}`);
      return 2;
    }
  }

  io.stdout('');
  io.stdout(formatSummary(outcomes));
  return outcomes.some(outcomeIsFailure) ? 1 : 0;
}

/** Format a single fixture outcome for the console. */
export function formatOutcome(outcome: FixtureScoreOutcome): string {
  const lines = [outcome.summary];
  if (outcome.status === 'scored' && outcome.report !== null) {
    for (const frame of outcome.report.frames) {
      const psnr = Number.isFinite(frame.psnr) ? frame.psnr.toFixed(2) : '∞';
      const marker = frame.passed ? '✓' : '✗';
      const detail = frame.reasons.length > 0 ? ` — ${frame.reasons.join(', ')}` : '';
      lines.push(
        `  ${marker} frame ${frame.frame}: PSNR ${psnr} dB, SSIM ${frame.ssim.toFixed(4)}${detail}`,
      );
    }
    if (outcome.report.reasons.length > 0) {
      for (const reason of outcome.report.reasons) {
        lines.push(`  aggregate: ${reason}`);
      }
    }
  } else if (outcome.status === 'missing-frames') {
    for (const miss of outcome.missingFrames) {
      lines.push(`  ? frame ${miss.frame}: missing ${miss.reason}`);
    }
  }
  return lines.join('\n');
}

/** Terminal run-summary line. */
export function formatSummary(outcomes: readonly FixtureScoreOutcome[]): string {
  const scored = outcomes.filter((o) => o.status === 'scored');
  const failed = scored.filter(outcomeIsFailure);
  const skipped = outcomes.filter((o) => o.status !== 'scored');
  return `stageflip-parity: ${scored.length - failed.length}/${scored.length} scored PASS, ${failed.length} FAIL, ${skipped.length} skipped`;
}
