// packages/parity-cli/src/prime-cli.ts
// `stageflip-parity prime` subcommand — argv parsing + orchestration
// + pretty output. Delegates the actual render step to a `PrimerFactory`
// port; the CLI entrypoint wires a real Puppeteer-backed primer, tests
// inject a deterministic fake.
//
// Usage:
//   stageflip-parity prime --reference-fixtures --out <dir>
//   stageflip-parity prime --reference-fixtures --out <dir> --dry-run
//   stageflip-parity prime --help
//
// Exit codes match the score subcommand:
//   0 — every input primed (or dry-run reported cleanly)
//   2 — usage / argument error

import { mkdir, writeFile } from 'node:fs/promises';

import type { RIRDocument } from '@stageflip/rir';

import type { CliIo } from './cli.js';
import { type PrimeFixtureInput, type PrimeRenderFn, primeFixture } from './prime.js';

export interface PrimeCliOptions {
  /** When true, render the 3 hand-coded REFERENCE_FIXTURES from @stageflip/renderer-cdp. */
  readonly referenceFixtures: boolean;
  /**
   * Fixtures directory to prime. Each *.json under the dir is parsed as
   * a FixtureManifest, converted to RIRDocument via `manifestToDocument`,
   * and rendered at the manifest's `referenceFrames` positions. Mutually
   * exclusive with `--reference-fixtures`.
   */
  readonly parityFixturesDir?: string;
  /** Root output directory. One subdir per fixture. */
  readonly outDir?: string;
  /** When true, paths are computed + reported but no render / writeFile happens. */
  readonly dryRun: boolean;
  readonly help: boolean;
}

export const PRIME_HELP_TEXT = `stageflip-parity prime — render fixtures to golden PNGs

USAGE
  stageflip-parity prime --reference-fixtures --out <dir>
  stageflip-parity prime --parity <fixtures-dir> --out <dir>
  stageflip-parity prime [--reference-fixtures|--parity <dir>] --out <dir> --dry-run
  stageflip-parity prime --help

OPTIONS
  --reference-fixtures   Prime the 3 hand-coded RIRDocument fixtures
                         from @stageflip/renderer-cdp (solidBackground,
                         multiElement, videoClip).
  --parity <dir>         Prime every *.json under <dir> as a parity
                         fixture (FixtureManifest → RIRDocument via
                         manifestToDocument); rendered at each
                         manifest's referenceFrames positions.
  --out <dir>            Root output directory. One subdir per fixture.
                         Operators copy PNGs from here into each
                         fixture's goldens.dir.
  --dry-run              Compute + report target paths; no render, no
                         write.
  -h, --help             Print this message.

NOTES
  Exactly one of --reference-fixtures or --parity must be set.
`;

/** Pure parser for the prime subcommand's argv (NOT including the leading "prime" token). */
export function parsePrimeArgs(argv: readonly string[]): PrimeCliOptions {
  let referenceFixtures = false;
  let parityFixturesDir: string | undefined;
  let outDir: string | undefined;
  let dryRun = false;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      help = true;
      continue;
    }
    if (arg === '--reference-fixtures') {
      referenceFixtures = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--out') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--out requires an argument');
      outDir = next;
      i++;
      continue;
    }
    if (arg === '--parity') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--parity requires a fixtures-dir argument');
      parityFixturesDir = next;
      i++;
      continue;
    }
    if (arg?.startsWith('--')) {
      throw new Error(`unknown flag: ${arg}`);
    }
    throw new Error(`unexpected positional argument: ${arg}`);
  }
  return {
    referenceFixtures,
    dryRun,
    help,
    ...(parityFixturesDir !== undefined ? { parityFixturesDir } : {}),
    ...(outDir !== undefined ? { outDir } : {}),
  };
}

/**
 * Resolves the set of inputs implied by the parsed CLI options. The
 * real implementation (`createPrimeInputResolver` in
 * `puppeteer-primer.ts`) handles both `--reference-fixtures` (3 hand-
 * coded docs from renderer-cdp) and `--parity <dir>` (*.json under
 * <dir>, each converted via `manifestToDocument`). Tests inject a
 * stub.
 */
export interface PrimeInputResolver {
  resolve(opts: PrimeCliOptions): Promise<readonly PrimeFixtureInput[]>;
}

/**
 * Factory for the `PrimeRenderFn` + its cleanup hook. The real impl
 * (in `puppeteer-primer.ts`) launches Chrome and returns a render
 * callback closed over the session; tests pass a stub that returns
 * canned bytes synchronously.
 */
export type PrimerFactory = () => Promise<{ render: PrimeRenderFn; close: () => Promise<void> }>;

/** Filesystem seam for `runPrime`; default uses node:fs/promises. */
export interface PrimeRuntimeFs {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

const DEFAULT_FS: PrimeRuntimeFs = {
  async mkdir(path) {
    await mkdir(path, { recursive: true });
  },
  async writeFile(path, data) {
    await writeFile(path, data);
  },
};

/** Dependencies injected by the CLI entrypoint or a test. */
export interface PrimeRunDeps {
  readonly resolver: PrimeInputResolver;
  readonly createPrimer: PrimerFactory;
  readonly fs?: PrimeRuntimeFs;
}

/**
 * Entry for the `prime` subcommand. `argv` must NOT include the
 * leading `prime` token (the parent dispatcher strips it).
 */
export async function runPrime(
  argv: readonly string[],
  deps: PrimeRunDeps,
  io: CliIo,
): Promise<number> {
  let opts: PrimeCliOptions;
  try {
    opts = parsePrimeArgs(argv);
  } catch (err) {
    io.stderr(`stageflip-parity prime: ${(err as Error).message}`);
    io.stderr(PRIME_HELP_TEXT);
    return 2;
  }
  if (opts.help) {
    io.stdout(PRIME_HELP_TEXT);
    return 0;
  }
  const hasReference = opts.referenceFixtures;
  const hasParity = opts.parityFixturesDir !== undefined;
  if (hasReference && hasParity) {
    io.stderr('stageflip-parity prime: --reference-fixtures and --parity are mutually exclusive');
    io.stderr(PRIME_HELP_TEXT);
    return 2;
  }
  if (!hasReference && !hasParity) {
    io.stderr('stageflip-parity prime: one of --reference-fixtures or --parity <dir> is required');
    io.stderr(PRIME_HELP_TEXT);
    return 2;
  }
  if (opts.outDir === undefined) {
    io.stderr('stageflip-parity prime: --out <dir> is required');
    io.stderr(PRIME_HELP_TEXT);
    return 2;
  }

  const inputs = await deps.resolver.resolve(opts);
  if (inputs.length === 0) {
    io.stderr('stageflip-parity prime: resolver returned no fixtures');
    return 2;
  }

  const fs = deps.fs ?? DEFAULT_FS;
  let primer: { render: PrimeRenderFn; close: () => Promise<void> } | null = null;
  if (!opts.dryRun) {
    primer = await deps.createPrimer();
  }
  try {
    for (const input of inputs) {
      const outcome = await primeFixture(input, {
        render: primer?.render ?? neverRender,
        fs,
        outDir: opts.outDir,
        dryRun: opts.dryRun,
      });
      io.stdout(outcome.summary);
      for (const p of outcome.writtenPaths) {
        io.stdout(`  ${opts.dryRun ? '?' : '✓'} ${p}`);
      }
    }
  } finally {
    if (primer !== null) {
      await primer.close();
    }
  }
  return 0;
}

/** Compute the default snapshot frame set for an RIRDocument: [0, mid, last]. Exported for tests + the resolver. */
export function defaultReferenceFrames(doc: RIRDocument): readonly number[] {
  const last = doc.durationFrames - 1;
  if (last <= 0) return [0];
  const mid = Math.floor(last / 2);
  return [0, mid, last];
}

const neverRender: PrimeRenderFn = async () => {
  throw new Error('prime: render callback invoked under dry-run (should be unreachable)');
};
