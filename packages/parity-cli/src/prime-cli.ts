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
  /** Root output directory. One subdir per fixture. */
  readonly outDir?: string;
  /** When true, paths are computed + reported but no render / writeFile happens. */
  readonly dryRun: boolean;
  readonly help: boolean;
}

export const PRIME_HELP_TEXT = `stageflip-parity prime — render fixtures to golden PNGs

USAGE
  stageflip-parity prime --reference-fixtures --out <dir>
  stageflip-parity prime --reference-fixtures --out <dir> --dry-run
  stageflip-parity prime --help

OPTIONS
  --reference-fixtures   Prime the 3 hand-coded RIRDocument fixtures from
                         @stageflip/renderer-cdp (solidBackground,
                         multiElement, videoClip). T-119b scope.
  --out <dir>            Root output directory. One subdir per fixture.
  --dry-run              Compute + report target paths; no render, no write.
  -h, --help             Print this message.

NOTES
  Priming the 5 parity fixtures under packages/testing/fixtures/ requires
  a FixtureManifest → RIRDocument converter (T-119d, deferred). Until
  that lands, --reference-fixtures is the only supported input.
`;

/** Pure parser for the prime subcommand's argv (NOT including the leading "prime" token). */
export function parsePrimeArgs(argv: readonly string[]): PrimeCliOptions {
  let referenceFixtures = false;
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
    if (arg?.startsWith('--')) {
      throw new Error(`unknown flag: ${arg}`);
    }
    throw new Error(`unexpected positional argument: ${arg}`);
  }
  return {
    referenceFixtures,
    dryRun,
    help,
    ...(outDir !== undefined ? { outDir } : {}),
  };
}

/** Resolve the input set implied by the parsed options. Throws with a usage error when nothing is selected. */
export interface PrimeInputResolver {
  /** Resolve the 3 REFERENCE_FIXTURES as PrimeFixtureInput[]. Real impl imports from @stageflip/renderer-cdp. */
  resolveReferenceFixtures(): Promise<readonly PrimeFixtureInput[]>;
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
  if (!opts.referenceFixtures) {
    io.stderr('stageflip-parity prime: --reference-fixtures is required (T-119b scope)');
    io.stderr(PRIME_HELP_TEXT);
    return 2;
  }
  if (opts.outDir === undefined) {
    io.stderr('stageflip-parity prime: --out <dir> is required');
    io.stderr(PRIME_HELP_TEXT);
    return 2;
  }

  const inputs = await deps.resolver.resolveReferenceFixtures();
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
