// packages/parity-cli/src/prime.ts
// Pure orchestrator for golden priming. Given one or more
// `(name, document, frames)` inputs and a `PrimeRenderFn` port, writes
// one PNG per (fixture, frame) under `outDir/<name>/` using an
// optional filename pattern. All IO goes through the injected
// `PrimeFsOps` so the orchestrator is fully unit-testable against a
// fake filesystem.
//
// T-119b narrows the real render path to the 3 hand-coded
// `RIRDocument` entries in `@stageflip/renderer-cdp`'s
// `REFERENCE_FIXTURES`. The 5 JSON parity fixtures under
// `packages/testing/fixtures/` need a `FixtureManifest → RIRDocument`
// converter that doesn't exist yet (T-119d).
//
// Dry-run mode records the paths it would have written without
// actually invoking the render callback for IO; this keeps CI and
// local smoke tests fast when the goal is to audit which PNGs would
// land where.

import { join } from 'node:path';

import type { RIRDocument } from '@stageflip/rir';

/** Default filename pattern used when a `PrimeFixtureInput` omits `pattern`. Matches `DEFAULT_GOLDEN_PATTERN`. */
export const DEFAULT_PRIME_PATTERN = 'frame-${frame}.png';

/**
 * Render callback port. Given an RIR document and a frame index,
 * returns PNG bytes. The real implementation lives in
 * `puppeteer-primer.ts`; tests inject a deterministic fake.
 */
export type PrimeRenderFn = (doc: RIRDocument, frame: number) => Promise<Uint8Array>;

/** Filesystem seam used by the orchestrator. Injected for testability. */
export interface PrimeFsOps {
  /** Create a directory, including parents. Idempotent — must not throw if dir exists. */
  mkdir(path: string): Promise<void>;
  /** Write bytes to `path`, overwriting any existing file. */
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

/** One fixture to prime. */
export interface PrimeFixtureInput {
  /** Subdirectory name under `outDir`. Typically the fixture id. */
  readonly name: string;
  /** The RIR document to render. Must round-trip `rirDocumentSchema`. */
  readonly document: RIRDocument;
  /** Frame indices to snapshot. Must contain at least one entry. */
  readonly frames: readonly number[];
  /** Filename pattern; `${frame}` is substituted. Defaults to `DEFAULT_PRIME_PATTERN`. */
  readonly pattern?: string;
}

/** Single-fixture priming outcome. */
export interface PrimeOutcome {
  readonly name: string;
  /** PNGs that were written (or would have been, under dry-run). */
  readonly writtenPaths: readonly string[];
  readonly dryRun: boolean;
  /** Human-readable one-line summary. */
  readonly summary: string;
}

/** Shared options across one `primeFixture` invocation. */
export interface PrimeOptions {
  readonly render: PrimeRenderFn;
  readonly fs: PrimeFsOps;
  /** Root output directory. The per-fixture subdir is `join(outDir, input.name)`. */
  readonly outDir: string;
  /** When true: no render + no writeFile; still emits `writtenPaths` describing intent. */
  readonly dryRun?: boolean;
}

/**
 * Prime one fixture. Renders each `frame` through `opts.render`, then
 * writes the resulting PNG to `join(outDir, name, pattern)` via
 * `opts.fs.writeFile`. Under dry-run, neither render nor writeFile
 * is invoked — only the target paths are computed and returned.
 */
export async function primeFixture(
  input: PrimeFixtureInput,
  opts: PrimeOptions,
): Promise<PrimeOutcome> {
  if (input.frames.length === 0) {
    throw new Error(`primeFixture: ${input.name} has no frames to prime`);
  }
  const pattern = input.pattern ?? DEFAULT_PRIME_PATTERN;
  const fixtureDir = join(opts.outDir, input.name);
  const dryRun = opts.dryRun ?? false;

  const writtenPaths: string[] = [];
  if (!dryRun) {
    await opts.fs.mkdir(fixtureDir);
  }
  for (const frame of input.frames) {
    const outPath = join(fixtureDir, pattern.replaceAll('${frame}', String(frame)));
    writtenPaths.push(outPath);
    if (dryRun) continue;
    const png = await opts.render(input.document, frame);
    await opts.fs.writeFile(outPath, png);
  }

  const summary = dryRun
    ? `${input.name}: dry-run — would write ${writtenPaths.length} PNG(s) to ${fixtureDir}`
    : `${input.name}: primed ${writtenPaths.length} PNG(s) into ${fixtureDir}`;
  return { name: input.name, writtenPaths, dryRun, summary };
}
