// packages/parity-cli/src/score-fixture.ts
// Core scoring orchestrator. Given a fixture JSON path and a
// directory holding candidate PNGs, resolves thresholds + goldens,
// loads frames via `@stageflip/parity`'s `loadPng`, runs
// `scoreFrames`, and returns a structured report.
//
// Pure-ish: all IO is filesystem reads (no network, no timers, no
// random). The function never throws on score failures — threshold
// violations are reported via the returned report's `passed` flag
// and per-frame reasons. It only throws on IO / parse errors.

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import {
  type ParityThresholds,
  type Region,
  type ScoreReport,
  loadPng,
  resolveThresholds,
  scoreFrames,
} from '@stageflip/parity';
import {
  DEFAULT_GOLDEN_PATTERN,
  type FixtureManifest,
  parseFixtureManifest,
  resolveGoldenPath,
} from '@stageflip/testing';

/** Outcome of attempting to score a single fixture. */
export interface FixtureScoreOutcome {
  readonly fixturePath: string;
  readonly manifest: FixtureManifest;
  /** The threshold set actually used (manifest-override merged over parity defaults). */
  readonly thresholds: ParityThresholds;
  /** Report from `scoreFrames`, or `null` if scoring was skipped. */
  readonly report: ScoreReport | null;
  /** One of: 'scored', 'no-goldens', 'no-candidates', 'missing-frames'. */
  readonly status: 'scored' | 'no-goldens' | 'no-candidates' | 'missing-frames';
  /** Per-frame missing assets that caused a 'missing-frames' verdict. */
  readonly missingFrames: readonly MissingFrame[];
  /** Human-readable one-line summary. */
  readonly summary: string;
}

export interface MissingFrame {
  readonly frame: number;
  readonly goldenPath: string | null;
  readonly candidatePath: string;
  readonly reason: 'golden' | 'candidate' | 'both';
}

export interface ScoreFixtureOptions {
  /**
   * Directory holding candidate PNGs. Defaults to the fixture's
   * sibling `candidates/<fixture-name>/` directory when omitted.
   */
  readonly candidatesDir?: string;
  /**
   * Filename pattern under `candidatesDir`; `${frame}` is substituted.
   * Defaults to the fixture's `goldens.pattern` (if set), otherwise
   * `DEFAULT_GOLDEN_PATTERN`.
   */
  readonly candidatesPattern?: string;
}

/**
 * Score one fixture against its goldens.
 *
 * Flow:
 *   1. Parse the fixture JSON.
 *   2. Resolve thresholds (manifest override → parity defaults).
 *   3. For each `referenceFrames[i]`:
 *      - Compute candidate path + golden path.
 *      - If either is missing, record as a `MissingFrame`.
 *   4. If no `goldens` block → status `'no-goldens'`, report `null`.
 *   5. If the candidate dir is missing entirely → `'no-candidates'`.
 *   6. If any frame was missing → `'missing-frames'`, skip scoring.
 *   7. Otherwise load PNGs + run `scoreFrames` → `'scored'`.
 */
export async function scoreFixture(
  fixturePath: string,
  options?: ScoreFixtureOptions,
): Promise<FixtureScoreOutcome> {
  const raw = await readFile(fixturePath, 'utf8');
  const manifest = parseFixtureManifest(JSON.parse(raw) as unknown);
  const fixtureDir = dirname(resolve(fixturePath));
  const thresholds = resolveThresholds({
    ...(manifest.thresholds?.minPsnr !== undefined ? { minPsnr: manifest.thresholds.minPsnr } : {}),
    ...(manifest.thresholds?.minSsim !== undefined ? { minSsim: manifest.thresholds.minSsim } : {}),
    ...(manifest.thresholds?.maxFailingFrames !== undefined
      ? { maxFailingFrames: manifest.thresholds.maxFailingFrames }
      : {}),
  });
  const region: Region | undefined = manifest.thresholds?.region;

  if (!manifest.goldens) {
    return {
      fixturePath,
      manifest,
      thresholds,
      report: null,
      status: 'no-goldens',
      missingFrames: [],
      summary: `${manifest.name}: skipped (no goldens block; fixture is input-only)`,
    };
  }

  const candidatesDir = options?.candidatesDir ?? join(fixtureDir, 'candidates', manifest.name);
  const candidatesPattern =
    options?.candidatesPattern ?? manifest.goldens.pattern ?? DEFAULT_GOLDEN_PATTERN;

  // Resolve paths for every reference frame. Missing either side is
  // tracked per-frame.
  const resolved = manifest.referenceFrames.map((frame) => {
    const goldenPath = resolveGoldenPath(manifest, fixtureDir, frame);
    const candidatePath = join(
      candidatesDir,
      candidatesPattern.replaceAll('${frame}', String(frame)),
    );
    return { frame, goldenPath, candidatePath };
  });

  const missing: MissingFrame[] = [];
  for (const { frame, goldenPath, candidatePath } of resolved) {
    const goldenOk = goldenPath !== null && (await exists(goldenPath));
    const candidateOk = await exists(candidatePath);
    if (!goldenOk || !candidateOk) {
      const reason: MissingFrame['reason'] =
        !goldenOk && !candidateOk ? 'both' : !goldenOk ? 'golden' : 'candidate';
      missing.push({ frame, goldenPath, candidatePath, reason });
    }
  }

  if (missing.length === manifest.referenceFrames.length) {
    // Every frame is missing the candidate side → the caller likely
    // hasn't rendered yet. Distinguish from "one frame slipped".
    const allCandidatesMissing = missing.every((m) => m.reason !== 'golden');
    if (allCandidatesMissing) {
      return {
        fixturePath,
        manifest,
        thresholds,
        report: null,
        status: 'no-candidates',
        missingFrames: missing,
        summary: `${manifest.name}: skipped (no candidate frames found at ${candidatesDir})`,
      };
    }
  }

  if (missing.length > 0) {
    return {
      fixturePath,
      manifest,
      thresholds,
      report: null,
      status: 'missing-frames',
      missingFrames: missing,
      summary: `${manifest.name}: skipped (${missing.length}/${manifest.referenceFrames.length} frame(s) missing)`,
    };
  }

  // Load + score.
  const inputs = await Promise.all(
    resolved.map(async ({ frame, goldenPath, candidatePath }) => {
      // `goldenPath` is non-null here — caller would have fallen into
      // the `missing` branch otherwise.
      const golden = await loadPng(goldenPath as string);
      const candidate = await loadPng(candidatePath);
      return region !== undefined
        ? { frame, candidate, golden, region }
        : { frame, candidate, golden };
    }),
  );
  const report = scoreFrames(inputs, { thresholds });
  const verdict = report.passed ? 'PASS' : 'FAIL';
  const minPsnr = Number.isFinite(report.minPsnr) ? report.minPsnr.toFixed(2) : '∞';
  const summary = `${manifest.name}: ${verdict} (PSNR min ${minPsnr} dB, SSIM min ${report.minSsim.toFixed(4)}, ${report.failingFrames}/${report.frames.length} failing)`;
  return {
    fixturePath,
    manifest,
    thresholds,
    report,
    status: 'scored',
    missingFrames: [],
    summary,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the outcome represents a "hard fail" for the overall CLI —
 * used by `runCli` to derive the process exit code. Skipped outcomes
 * (no-goldens, no-candidates, missing-frames) are NOT failures; they
 * produce a 0 exit code so CI can still green-light PRs that don't
 * touch a given fixture's goldens. Only scored-and-failed counts as
 * a hard fail.
 */
export function outcomeIsFailure(outcome: FixtureScoreOutcome): boolean {
  return outcome.status === 'scored' && outcome.report?.passed === false;
}
