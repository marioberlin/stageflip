// packages/parity-cli/src/viewer.ts
// T-137 — orchestrator that turns a list of `FixtureScoreOutcome`s into
// a `ViewerHtmlInput` by reading each frame's golden + candidate PNGs off
// disk and base64-embedding them as data URIs. IO is injected via a
// `PngReader` port so tests drive the orchestrator with fake bytes and
// no filesystem access.
//
// The two concerns (path resolution + byte loading) are the same ones
// `score-fixture.ts` already solves, but we can't reuse that code
// directly because scoring needs decoded RGBA pixel buffers while the
// viewer wants raw bytes for `data:image/png;base64,…` URIs. A second
// pass over the same paths is cheaper than threading an extra surface
// through the scoring orchestrator.

import { dirname, join, resolve } from 'node:path';

import {
  DEFAULT_GOLDEN_PATTERN,
  type FixtureManifest,
  resolveGoldenPath,
} from '@stageflip/testing';

import type { FixtureScoreOutcome } from './score-fixture.js';
import type { ViewerFixture, ViewerFrame, ViewerHtmlInput } from './viewer-html.js';

/** Byte-level PNG reader. Injected so tests don't need real files. */
export type PngReader = (path: string) => Promise<Buffer>;

export interface BuildViewerInputOptions {
  /** Document title forwarded to the HTML renderer. */
  readonly title?: string;
  /**
   * ISO timestamp stamped into the report footer. Caller supplies it so
   * the CLI layer can sample `new Date()` once and tests can pin to a
   * fixed string for snapshot stability.
   */
  readonly generatedAt: string;
  /**
   * Override for the candidates directory used by `scoreFixture`. Must
   * match what scoring used, otherwise the viewer loads wrong bytes.
   */
  readonly candidatesDir?: string;
}

/**
 * Build a `ViewerHtmlInput` from scored outcomes.
 *
 * Per frame, resolves the same golden + candidate paths that
 * `scoreFixture` resolved, then reads raw bytes via the injected
 * `pngReader`. Missing paths yield `goldenUri: null` / `candidateUri:
 * null` with the `missingReason` carried through from the outcome's
 * `missingFrames` list.
 */
export async function buildViewerInput(
  outcomes: readonly FixtureScoreOutcome[],
  pngReader: PngReader,
  options: BuildViewerInputOptions,
): Promise<ViewerHtmlInput> {
  const fixtures: ViewerFixture[] = [];
  for (const outcome of outcomes) {
    fixtures.push(await buildFixture(outcome, pngReader, options));
  }
  return {
    ...(options.title !== undefined ? { title: options.title } : {}),
    fixtures,
    generatedAt: options.generatedAt,
  };
}

async function buildFixture(
  outcome: FixtureScoreOutcome,
  pngReader: PngReader,
  options: BuildViewerInputOptions,
): Promise<ViewerFixture> {
  const { manifest } = outcome;
  const base: Omit<ViewerFixture, 'frames'> = {
    name: manifest.name,
    status: outcome.status,
    summary: outcome.summary,
    ...(manifest.description ? { manifestDescription: manifest.description } : {}),
    width: manifest.composition.width,
    height: manifest.composition.height,
    thresholds: outcome.thresholds,
  };

  // Unscored statuses render as skip banners — no frame loads.
  if (outcome.status !== 'scored' && outcome.status !== 'missing-frames') {
    return { ...base, frames: [] };
  }

  const fixtureDir = dirname(resolve(outcome.fixturePath));
  const candidatesDir = options.candidatesDir ?? join(fixtureDir, 'candidates', manifest.name);
  const candidatesPattern = manifest.goldens?.pattern ?? DEFAULT_GOLDEN_PATTERN;

  const missingByFrame = new Map(outcome.missingFrames.map((m) => [m.frame, m] as const));

  const frames: ViewerFrame[] = [];
  for (const frameNum of manifest.referenceFrames) {
    frames.push(
      await buildFrame({
        frame: frameNum,
        outcome,
        manifest,
        fixtureDir,
        candidatesDir,
        candidatesPattern,
        missingByFrame,
        pngReader,
      }),
    );
  }
  return { ...base, frames };
}

interface BuildFrameArgs {
  readonly frame: number;
  readonly outcome: FixtureScoreOutcome;
  readonly manifest: FixtureManifest;
  readonly fixtureDir: string;
  readonly candidatesDir: string;
  readonly candidatesPattern: string;
  readonly missingByFrame: ReadonlyMap<number, FixtureScoreOutcome['missingFrames'][number]>;
  readonly pngReader: PngReader;
}

async function buildFrame(args: BuildFrameArgs): Promise<ViewerFrame> {
  const goldenPath = resolveGoldenPath(args.manifest, args.fixtureDir, args.frame);
  const candidatePath = join(
    args.candidatesDir,
    args.candidatesPattern.replaceAll('${frame}', String(args.frame)),
  );
  const missing = args.missingByFrame.get(args.frame);

  const goldenUri = await maybeLoadDataUri(
    goldenPath,
    args.pngReader,
    missing?.reason === 'golden' || missing?.reason === 'both',
  );
  const candidateUri = await maybeLoadDataUri(
    candidatePath,
    args.pngReader,
    missing?.reason === 'candidate' || missing?.reason === 'both',
  );

  const score = args.outcome.report?.frames.find((f) => f.frame === args.frame) ?? null;

  return {
    frame: args.frame,
    goldenUri,
    candidateUri,
    score,
    ...(missing ? { missingReason: missing.reason } : {}),
  };
}

async function maybeLoadDataUri(
  path: string | null,
  pngReader: PngReader,
  knownMissing: boolean,
): Promise<string | null> {
  if (path === null || knownMissing) return null;
  try {
    const bytes = await pngReader(path);
    return `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    // A read that fails here means the outcome claimed the path was
    // present but something changed between scoring and viewing. Treat
    // as missing rather than crashing the whole report.
    return null;
  }
}
