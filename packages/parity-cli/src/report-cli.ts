// packages/parity-cli/src/report-cli.ts
// `stageflip-parity report` subcommand — T-137 visual-diff viewer.
// Scores the same set of fixtures `stageflip-parity` (score mode)
// would, then renders a self-contained HTML artifact with side-by-side
// / slider / overlay-difference views of every scored frame.
//
// Usage:
//   stageflip-parity report [fixture.json ...] [--out <file>]
//   stageflip-parity report --fixtures-dir <dir> [--out <file>]
//   stageflip-parity report --help
//
// Exit codes:
//   0 — HTML emitted successfully (regardless of PASS/FAIL on scoring).
//       The viewer is a *tool*, not a gate; the score subcommand is the
//       gate. Opening a report on a FAIL is the expected workflow.
//   2 — usage / argument error.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

import type { CliIo } from './cli.js';
import { type FixtureScoreOutcome, scoreFixture } from './score-fixture.js';
import { renderViewerHtml } from './viewer-html.js';
import { buildViewerInput } from './viewer.js';

export interface ReportCliOptions {
  readonly fixtures: readonly string[];
  readonly fixturesDir?: string;
  readonly candidatesDir?: string;
  /** Where the HTML goes. Defaults to `parity-report.html` in the cwd. */
  readonly outPath?: string;
  /** Document title threaded through to `renderViewerHtml`. */
  readonly title?: string;
  readonly help: boolean;
}

export const REPORT_HELP_TEXT = `stageflip-parity report — build an HTML visual-diff viewer

USAGE
  stageflip-parity report [fixture.json ...] [--out <file>]
  stageflip-parity report --fixtures-dir <dir> [--out <file>]
  stageflip-parity report --help

OPTIONS
  --fixtures-dir <dir>   Include every *.json under <dir>.
  --candidates <dir>     Shared candidates directory (same semantics as
                         score mode). Defaults to
                         <fixture-dir>/candidates/<fixture-name>/.
  --out <file>           HTML output path. Defaults to
                         parity-report.html in the current directory.
  --title <text>         Document title shown in the report header.
  -h, --help             Print this message.

EXIT CODES
  0  HTML emitted successfully (scoring PASS/FAIL does NOT change this;
     the viewer is a tool, not a gate).
  2  usage / argument error.
`;

/** Pure argv parse — no IO. Mirrors the score CLI's argv conventions. */
export function parseReportArgs(argv: readonly string[]): ReportCliOptions {
  const fixtures: string[] = [];
  let fixturesDir: string | undefined;
  let candidatesDir: string | undefined;
  let outPath: string | undefined;
  let title: string | undefined;
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
    if (arg === '--out') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--out requires an argument');
      outPath = next;
      i++;
      continue;
    }
    if (arg === '--title') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--title requires an argument');
      title = next;
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
    ...(outPath !== undefined ? { outPath } : {}),
    ...(title !== undefined ? { title } : {}),
  };
}

async function resolveFixtureList(opts: ReportCliOptions): Promise<string[]> {
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

/**
 * Main entry for the `report` subcommand. Returns an exit code; never
 * calls `process.exit` so tests drive it directly.
 */
export async function runReport(argv: readonly string[], io: CliIo): Promise<number> {
  let opts: ReportCliOptions;
  try {
    opts = parseReportArgs(argv);
  } catch (err) {
    io.stderr(`stageflip-parity report: ${(err as Error).message}`);
    io.stderr(REPORT_HELP_TEXT);
    return 2;
  }
  if (opts.help) {
    io.stdout(REPORT_HELP_TEXT);
    return 0;
  }

  let fixtures: string[];
  try {
    fixtures = await resolveFixtureList(opts);
  } catch (err) {
    io.stderr(`stageflip-parity report: ${(err as Error).message}`);
    return 2;
  }
  if (fixtures.length === 0) {
    io.stderr(
      'stageflip-parity report: no fixtures specified (pass one or more JSON paths, or --fixtures-dir)',
    );
    io.stderr(REPORT_HELP_TEXT);
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
      io.stdout(outcome.summary);
    } catch (err) {
      io.stderr(`stageflip-parity report: ${path} — ${(err as Error).message}`);
      return 2;
    }
  }

  const input = await buildViewerInput(outcomes, (path) => readFile(path), {
    generatedAt: new Date().toISOString(),
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.candidatesDir !== undefined ? { candidatesDir: opts.candidatesDir } : {}),
  });
  const html = renderViewerHtml(input);

  const outPath = resolve(opts.outPath ?? 'parity-report.html');
  await writeFile(outPath, html, 'utf8');
  io.stdout(`stageflip-parity report: wrote ${outPath}`);
  return 0;
}
