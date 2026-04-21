// packages/parity-cli/src/score-fixture.test.ts
// End-to-end tests for `scoreFixture` — drives the whole pipeline
// (fixture parse → threshold resolve → path resolution → exists
// checks → PNG load → `scoreFrames`) against a temp directory.
//
// Uses `pngjs` directly (already a transitive dep via
// `@stageflip/parity`) to synthesise goldens + candidates. No
// real rendering; no Chrome; no FFmpeg.

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { outcomeIsFailure, scoreFixture } from './score-fixture';

const W = 8;
const H = 8;

function encodeSolid(r: number, g: number, b: number): Buffer {
  const png = new PNG({ width: W, height: H, colorType: 6 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

interface FixtureTree {
  readonly root: string;
  readonly fixturePath: string;
}

async function makeFixture(opts: {
  readonly thresholds?: {
    minPsnr?: number;
    minSsim?: number;
    maxFailingFrames?: number;
  };
  readonly goldens?: boolean;
}): Promise<FixtureTree> {
  const root = await mkdtemp(join(tmpdir(), 'parity-cli-'));
  const manifest: Record<string, unknown> = {
    name: 'test-fixture',
    runtime: 'css',
    kind: 'solid-background',
    description: 'unit-test solid',
    composition: { width: W, height: H, fps: 30, durationInFrames: 30 },
    clip: { from: 0, durationInFrames: 30, props: { color: '#ff0000' } },
    referenceFrames: [0, 15, 29],
  };
  if (opts.thresholds) manifest.thresholds = opts.thresholds;
  if (opts.goldens !== false) manifest.goldens = { dir: 'goldens/test-fixture' };
  const fixturePath = join(root, 'test-fixture.json');
  await writeFile(fixturePath, JSON.stringify(manifest), 'utf8');
  return { root, fixturePath };
}

async function writeFrame(dir: string, frame: number, bytes: Buffer): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `frame-${frame}.png`), bytes);
}

describe('scoreFixture', () => {
  const trees: string[] = [];

  afterEach(async () => {
    while (trees.length > 0) {
      const root = trees.pop();
      if (root) await rm(root, { recursive: true, force: true });
    }
  });

  it('returns status="no-goldens" when the manifest has no goldens block', async () => {
    const tree = await makeFixture({ goldens: false });
    trees.push(tree.root);
    const outcome = await scoreFixture(tree.fixturePath);
    expect(outcome.status).toBe('no-goldens');
    expect(outcome.report).toBeNull();
    expect(outcome.summary).toMatch(/no goldens block/);
    expect(outcomeIsFailure(outcome)).toBe(false);
  });

  it('returns status="no-candidates" when the candidates dir is entirely missing', async () => {
    const tree = await makeFixture({});
    trees.push(tree.root);
    // Write goldens but no candidates.
    const goldensDir = join(tree.root, 'goldens/test-fixture');
    for (const frame of [0, 15, 29]) {
      await writeFrame(goldensDir, frame, encodeSolid(255, 0, 0));
    }
    const outcome = await scoreFixture(tree.fixturePath);
    expect(outcome.status).toBe('no-candidates');
    expect(outcome.report).toBeNull();
    expect(outcome.summary).toMatch(/no candidate frames found/);
    expect(outcomeIsFailure(outcome)).toBe(false);
  });

  it('returns status="missing-frames" when some (but not all) frames are missing', async () => {
    const tree = await makeFixture({});
    trees.push(tree.root);
    const goldensDir = join(tree.root, 'goldens/test-fixture');
    const candidatesDir = join(tree.root, 'candidates/test-fixture');
    for (const frame of [0, 15, 29]) {
      await writeFrame(goldensDir, frame, encodeSolid(255, 0, 0));
    }
    // Only write candidates for 0 + 29 — frame 15 is missing.
    await writeFrame(candidatesDir, 0, encodeSolid(255, 0, 0));
    await writeFrame(candidatesDir, 29, encodeSolid(255, 0, 0));
    const outcome = await scoreFixture(tree.fixturePath);
    expect(outcome.status).toBe('missing-frames');
    expect(outcome.missingFrames).toHaveLength(1);
    expect(outcome.missingFrames[0]?.frame).toBe(15);
    expect(outcome.missingFrames[0]?.reason).toBe('candidate');
    expect(outcomeIsFailure(outcome)).toBe(false);
  });

  it('scores identical goldens + candidates as PASS with Infinity PSNR', async () => {
    const tree = await makeFixture({
      thresholds: { minPsnr: 30, minSsim: 0.97, maxFailingFrames: 0 },
    });
    trees.push(tree.root);
    const goldensDir = join(tree.root, 'goldens/test-fixture');
    const candidatesDir = join(tree.root, 'candidates/test-fixture');
    for (const frame of [0, 15, 29]) {
      const bytes = encodeSolid(255, 0, 0);
      await writeFrame(goldensDir, frame, bytes);
      await writeFrame(candidatesDir, frame, bytes);
    }
    const outcome = await scoreFixture(tree.fixturePath);
    expect(outcome.status).toBe('scored');
    expect(outcome.report?.passed).toBe(true);
    expect(outcome.report?.minPsnr).toBe(Number.POSITIVE_INFINITY);
    expect(outcome.report?.minSsim).toBe(1);
    expect(outcome.summary).toContain('PASS');
    expect(outcomeIsFailure(outcome)).toBe(false);
  });

  it('scores visibly-different goldens + candidates as FAIL', async () => {
    const tree = await makeFixture({
      thresholds: { minPsnr: 40, minSsim: 0.97, maxFailingFrames: 0 },
    });
    trees.push(tree.root);
    const goldensDir = join(tree.root, 'goldens/test-fixture');
    const candidatesDir = join(tree.root, 'candidates/test-fixture');
    for (const frame of [0, 15, 29]) {
      await writeFrame(goldensDir, frame, encodeSolid(255, 0, 0));
      await writeFrame(candidatesDir, frame, encodeSolid(0, 0, 255)); // blue not red
    }
    const outcome = await scoreFixture(tree.fixturePath);
    expect(outcome.status).toBe('scored');
    expect(outcome.report?.passed).toBe(false);
    expect(outcomeIsFailure(outcome)).toBe(true);
    expect(outcome.summary).toContain('FAIL');
  });

  it('merges manifest thresholds over parity defaults', async () => {
    const tree = await makeFixture({ thresholds: { minPsnr: 42 } });
    trees.push(tree.root);
    const goldensDir = join(tree.root, 'goldens/test-fixture');
    const candidatesDir = join(tree.root, 'candidates/test-fixture');
    for (const frame of [0, 15, 29]) {
      const bytes = encodeSolid(128, 128, 128);
      await writeFrame(goldensDir, frame, bytes);
      await writeFrame(candidatesDir, frame, bytes);
    }
    const outcome = await scoreFixture(tree.fixturePath);
    expect(outcome.thresholds.minPsnr).toBe(42);
    expect(outcome.thresholds.minSsim).toBe(0.97); // default
    expect(outcome.thresholds.maxFailingFrames).toBe(0); // default
  });

  it('honours a caller-supplied candidates directory', async () => {
    const tree = await makeFixture({});
    trees.push(tree.root);
    const goldensDir = join(tree.root, 'goldens/test-fixture');
    const customCandidatesDir = join(tree.root, 'custom-candidates');
    for (const frame of [0, 15, 29]) {
      const bytes = encodeSolid(200, 100, 50);
      await writeFrame(goldensDir, frame, bytes);
      await writeFrame(customCandidatesDir, frame, bytes);
    }
    const outcome = await scoreFixture(tree.fixturePath, {
      candidatesDir: customCandidatesDir,
    });
    expect(outcome.status).toBe('scored');
    expect(outcome.report?.passed).toBe(true);
  });

  it('propagates invalid fixture JSON as a parse error', async () => {
    const tree = await makeFixture({});
    trees.push(tree.root);
    await writeFile(tree.fixturePath, 'not-json', 'utf8');
    await expect(scoreFixture(tree.fixturePath)).rejects.toThrow();
  });
});
