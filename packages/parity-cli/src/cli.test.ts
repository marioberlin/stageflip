// packages/parity-cli/src/cli.test.ts
// CLI surface tests. The heavy scoring path lives in
// `score-fixture.test.ts`; this file exercises arg parsing,
// exit-code derivation, IO routing, and the format helpers.

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type CliIo, formatOutcome, formatSummary, parseArgs, runCli } from './cli';

interface Recorder extends CliIo {
  readonly stdoutLines: string[];
  readonly stderrLines: string[];
}

function recorder(): Recorder {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  return {
    stdoutLines,
    stderrLines,
    stdout(line) {
      stdoutLines.push(line);
    },
    stderr(line) {
      stderrLines.push(line);
    },
  };
}

function encodeSolid(w: number, h: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width: w, height: h, colorType: 6 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe('parseArgs', () => {
  it('parses bare fixture paths', () => {
    const opts = parseArgs(['a.json', 'b.json']);
    expect(opts.fixtures).toEqual(['a.json', 'b.json']);
    expect(opts.help).toBe(false);
    expect(opts.fixturesDir).toBeUndefined();
  });

  it('parses --fixtures-dir', () => {
    const opts = parseArgs(['--fixtures-dir', 'packages/testing/fixtures']);
    expect(opts.fixturesDir).toBe('packages/testing/fixtures');
  });

  it('parses --candidates', () => {
    const opts = parseArgs(['a.json', '--candidates', 'out/frames']);
    expect(opts.fixtures).toEqual(['a.json']);
    expect(opts.candidatesDir).toBe('out/frames');
  });

  it('parses --help and -h', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('throws on --fixtures-dir without argument', () => {
    expect(() => parseArgs(['--fixtures-dir'])).toThrow(/requires an argument/);
  });

  it('throws on unknown flag', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/unknown flag/);
  });
});

describe('runCli', () => {
  const trees: string[] = [];

  afterEach(async () => {
    while (trees.length > 0) {
      const root = trees.pop();
      if (root) await rm(root, { recursive: true, force: true });
    }
  });

  async function setupFixture(opts: {
    goldens: boolean;
    candidates: 'match' | 'mismatch' | 'missing';
  }): Promise<{ root: string; fixturePath: string }> {
    const root = await mkdtemp(join(tmpdir(), 'parity-cli-cli-'));
    const manifest: Record<string, unknown> = {
      name: 'fx',
      runtime: 'css',
      kind: 'solid-background',
      description: 'cli-test',
      composition: { width: 4, height: 4, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 30, props: {} },
      referenceFrames: [0, 15, 29],
      thresholds: { minPsnr: 30, minSsim: 0.97, maxFailingFrames: 0 },
    };
    if (opts.goldens) {
      manifest.goldens = { dir: 'goldens/fx' };
      await mkdir(join(root, 'goldens/fx'), { recursive: true });
      for (const frame of [0, 15, 29]) {
        await writeFile(join(root, `goldens/fx/frame-${frame}.png`), encodeSolid(4, 4, 255, 0, 0));
      }
    }
    if (opts.candidates !== 'missing') {
      await mkdir(join(root, 'candidates/fx'), { recursive: true });
      for (const frame of [0, 15, 29]) {
        const [r, g, b] = opts.candidates === 'match' ? [255, 0, 0] : [0, 255, 0];
        await writeFile(join(root, `candidates/fx/frame-${frame}.png`), encodeSolid(4, 4, r, g, b));
      }
    }
    const fixturePath = join(root, 'fx.json');
    await writeFile(fixturePath, JSON.stringify(manifest), 'utf8');
    return { root, fixturePath };
  }

  it('prints help + exits 0 when --help is passed', async () => {
    const io = recorder();
    const exit = await runCli(['--help'], io);
    expect(exit).toBe(0);
    expect(io.stdoutLines.join('\n')).toContain('USAGE');
  });

  it('exits 2 with usage when no fixtures are given', async () => {
    const io = recorder();
    const exit = await runCli([], io);
    expect(exit).toBe(2);
    expect(io.stderrLines.join('\n')).toContain('no fixtures specified');
  });

  it('exits 2 on an unknown flag', async () => {
    const io = recorder();
    const exit = await runCli(['--nope'], io);
    expect(exit).toBe(2);
    expect(io.stderrLines.join('\n')).toContain('unknown flag');
  });

  it('exits 2 when both fixture paths AND --fixtures-dir are given', async () => {
    const io = recorder();
    const exit = await runCli(['a.json', '--fixtures-dir', '/x'], io);
    expect(exit).toBe(2);
    expect(io.stderrLines.join('\n')).toMatch(/fixture paths OR --fixtures-dir/);
  });

  it('exits 0 when every scored fixture passes', async () => {
    const tree = await setupFixture({ goldens: true, candidates: 'match' });
    trees.push(tree.root);
    const io = recorder();
    const exit = await runCli([tree.fixturePath], io);
    expect(exit).toBe(0);
    expect(io.stdoutLines.join('\n')).toContain('PASS');
    expect(io.stdoutLines.join('\n')).toContain('1/1 scored PASS');
  });

  it('exits 1 when a fixture FAILs its thresholds', async () => {
    const tree = await setupFixture({ goldens: true, candidates: 'mismatch' });
    trees.push(tree.root);
    const io = recorder();
    const exit = await runCli([tree.fixturePath], io);
    expect(exit).toBe(1);
    expect(io.stdoutLines.join('\n')).toContain('FAIL');
    expect(io.stdoutLines.join('\n')).toContain('1 FAIL');
  });

  it('exits 0 (not 1) when a fixture has no goldens — skipped does not fail the run', async () => {
    const tree = await setupFixture({ goldens: false, candidates: 'match' });
    trees.push(tree.root);
    const io = recorder();
    const exit = await runCli([tree.fixturePath], io);
    expect(exit).toBe(0);
    expect(io.stdoutLines.join('\n')).toMatch(/no goldens block/);
    expect(io.stdoutLines.join('\n')).toContain('1 skipped');
  });

  it('discovers every *.json under --fixtures-dir', async () => {
    const tree = await setupFixture({ goldens: true, candidates: 'match' });
    trees.push(tree.root);
    const io = recorder();
    const exit = await runCli(['--fixtures-dir', tree.root], io);
    expect(exit).toBe(0);
    expect(io.stdoutLines.join('\n')).toContain('PASS');
  });

  it('exits 2 on a bad --fixtures-dir', async () => {
    const io = recorder();
    const exit = await runCli(['--fixtures-dir', '/nope/does/not/exist'], io);
    expect(exit).toBe(2);
  });
});

describe('formatOutcome', () => {
  it('formats a scored-and-passed outcome with per-frame detail', () => {
    const line = formatOutcome({
      fixturePath: '/x/fx.json',
      manifest: { name: 'fx' } as never,
      thresholds: { minPsnr: 30, minSsim: 0.97, maxFailingFrames: 0 },
      report: {
        frames: [
          { frame: 0, psnr: Number.POSITIVE_INFINITY, ssim: 1, passed: true, reasons: [] },
          { frame: 15, psnr: 42.5, ssim: 0.98, passed: true, reasons: [] },
        ],
        failingFrames: 0,
        minPsnr: 42.5,
        minSsim: 0.98,
        passed: true,
        reasons: [],
        thresholds: { minPsnr: 30, minSsim: 0.97, maxFailingFrames: 0 },
      },
      status: 'scored',
      missingFrames: [],
      summary: 'fx: PASS (PSNR min 42.50 dB, SSIM min 0.9800, 0/2 failing)',
    });
    expect(line).toContain('fx: PASS');
    expect(line).toContain('frame 0: PSNR ∞');
    expect(line).toContain('frame 15: PSNR 42.50');
  });

  it('formats a missing-frames outcome with per-frame reasons', () => {
    const line = formatOutcome({
      fixturePath: '/x/fx.json',
      manifest: { name: 'fx' } as never,
      thresholds: { minPsnr: 30, minSsim: 0.97, maxFailingFrames: 0 },
      report: null,
      status: 'missing-frames',
      missingFrames: [
        { frame: 15, goldenPath: '/g/15.png', candidatePath: '/c/15.png', reason: 'candidate' },
      ],
      summary: 'fx: skipped (1/3 frame(s) missing)',
    });
    expect(line).toContain('fx: skipped');
    expect(line).toContain('frame 15: missing candidate');
  });
});

describe('formatSummary', () => {
  it('counts scored PASS + FAIL + skipped', () => {
    const line = formatSummary([
      { status: 'scored', report: { passed: true } } as never,
      { status: 'scored', report: { passed: false } } as never,
      { status: 'no-goldens' } as never,
      { status: 'no-candidates' } as never,
    ]);
    expect(line).toContain('1/2 scored PASS');
    expect(line).toContain('1 FAIL');
    expect(line).toContain('2 skipped');
  });
});
