// packages/parity-cli/src/viewer.test.ts
// Orchestrator tests — builds a ViewerHtmlInput from FixtureScoreOutcomes
// via a stubbed PNG reader.

import { describe, expect, it } from 'vitest';

import type { FixtureScoreOutcome } from './score-fixture.js';
import { type PngReader, buildViewerInput } from './viewer.js';

function makeOutcome(overrides: Partial<FixtureScoreOutcome> = {}): FixtureScoreOutcome {
  return {
    fixturePath: '/tmp/fixtures/css-solid-background.json',
    manifest: {
      name: 'css-solid-background',
      runtime: 'css',
      kind: 'solid-background',
      description: 'CSS baseline',
      composition: { width: 320, height: 180, fps: 30, durationInFrames: 30 },
      clip: { from: 0, durationInFrames: 30, props: {} },
      referenceFrames: [0, 15, 29],
      goldens: { dir: 'goldens/css-solid-background' },
    },
    thresholds: { minPsnr: 40, minSsim: 0.99, maxFailingFrames: 0 },
    report: {
      frames: [
        { frame: 0, psnr: 42.1, ssim: 0.998, passed: true, reasons: [] },
        { frame: 15, psnr: 41.5, ssim: 0.995, passed: true, reasons: [] },
        { frame: 29, psnr: 41.8, ssim: 0.996, passed: true, reasons: [] },
      ],
      failingFrames: 0,
      minPsnr: 41.5,
      minSsim: 0.995,
      passed: true,
      reasons: [],
      thresholds: { minPsnr: 40, minSsim: 0.99, maxFailingFrames: 0 },
    },
    status: 'scored',
    missingFrames: [],
    summary: 'css-solid-background: PASS (PSNR min 41.50 dB, SSIM min 0.9950, 0/3 failing)',
    ...overrides,
  } as FixtureScoreOutcome;
}

function fakeReader(contents: Record<string, Buffer>): PngReader {
  return async (path: string) => {
    const found = contents[path];
    if (!found) {
      throw new Error(`unexpected PNG read: ${path}`);
    }
    return found;
  };
}

function bytes(label: string): Buffer {
  return Buffer.from(`fake-png-${label}`);
}

describe('buildViewerInput', () => {
  it('reads one golden + one candidate per reference frame and embeds both as data URIs', async () => {
    const outcome = makeOutcome();
    const reader = fakeReader({
      '/tmp/fixtures/goldens/css-solid-background/frame-0.png': bytes('g0'),
      '/tmp/fixtures/goldens/css-solid-background/frame-15.png': bytes('g15'),
      '/tmp/fixtures/goldens/css-solid-background/frame-29.png': bytes('g29'),
      '/tmp/fixtures/candidates/css-solid-background/frame-0.png': bytes('c0'),
      '/tmp/fixtures/candidates/css-solid-background/frame-15.png': bytes('c15'),
      '/tmp/fixtures/candidates/css-solid-background/frame-29.png': bytes('c29'),
    });
    const input = await buildViewerInput([outcome], reader, { generatedAt: 'fixed' });
    expect(input.fixtures).toHaveLength(1);
    const fixture = input.fixtures[0];
    expect(fixture?.name).toBe('css-solid-background');
    expect(fixture?.status).toBe('scored');
    expect(fixture?.frames).toHaveLength(3);
    expect(fixture?.frames[0]?.goldenUri).toMatch(/^data:image\/png;base64,/);
    expect(fixture?.frames[0]?.candidateUri).toMatch(/^data:image\/png;base64,/);
    // Sanity: base64 of 'fake-png-g0'
    expect(fixture?.frames[0]?.goldenUri).toBe(
      `data:image/png;base64,${bytes('g0').toString('base64')}`,
    );
  });

  it('threads the FrameScore through unchanged so the HTML renderer gets per-frame metrics', async () => {
    const outcome = makeOutcome();
    const reader = fakeReader({
      '/tmp/fixtures/goldens/css-solid-background/frame-0.png': bytes('g'),
      '/tmp/fixtures/goldens/css-solid-background/frame-15.png': bytes('g'),
      '/tmp/fixtures/goldens/css-solid-background/frame-29.png': bytes('g'),
      '/tmp/fixtures/candidates/css-solid-background/frame-0.png': bytes('c'),
      '/tmp/fixtures/candidates/css-solid-background/frame-15.png': bytes('c'),
      '/tmp/fixtures/candidates/css-solid-background/frame-29.png': bytes('c'),
    });
    const input = await buildViewerInput([outcome], reader, { generatedAt: 'fixed' });
    expect(input.fixtures[0]?.frames[0]?.score?.psnr).toBe(42.1);
    expect(input.fixtures[0]?.frames[1]?.score?.ssim).toBe(0.995);
  });

  it('skips PNG loads when status is no-goldens (frames empty)', async () => {
    const outcome = makeOutcome({
      status: 'no-goldens',
      report: null,
      summary: 'css-solid-background: skipped (no goldens block; fixture is input-only)',
    });
    // Empty reader — any call would throw.
    const input = await buildViewerInput([outcome], fakeReader({}), { generatedAt: 'fixed' });
    expect(input.fixtures[0]?.status).toBe('no-goldens');
    expect(input.fixtures[0]?.frames).toEqual([]);
  });

  it('records a null uri + missingReason when a frame is missing its golden or candidate', async () => {
    const missingOutcome = makeOutcome({
      status: 'missing-frames',
      report: null,
      missingFrames: [
        {
          frame: 0,
          goldenPath: null,
          candidatePath: '/tmp/fixtures/candidates/css-solid-background/frame-0.png',
          reason: 'golden',
        },
      ],
      summary: 'css-solid-background: skipped (1/3 frame(s) missing)',
    });
    const reader = fakeReader({
      '/tmp/fixtures/candidates/css-solid-background/frame-0.png': bytes('c0'),
      '/tmp/fixtures/goldens/css-solid-background/frame-15.png': bytes('g15'),
      '/tmp/fixtures/candidates/css-solid-background/frame-15.png': bytes('c15'),
      '/tmp/fixtures/goldens/css-solid-background/frame-29.png': bytes('g29'),
      '/tmp/fixtures/candidates/css-solid-background/frame-29.png': bytes('c29'),
    });
    const input = await buildViewerInput([missingOutcome], reader, { generatedAt: 'fixed' });
    const frame0 = input.fixtures[0]?.frames[0];
    expect(frame0?.frame).toBe(0);
    expect(frame0?.goldenUri).toBeNull();
    expect(frame0?.candidateUri).toMatch(/^data:image\/png;base64,/);
    expect(frame0?.missingReason).toBe('golden');
  });

  it('aggregates multiple outcomes in input order, preserving per-fixture framing', async () => {
    const a = makeOutcome({
      fixturePath: '/tmp/fixtures/a.json',
      manifest: { ...makeOutcome().manifest, name: 'a', referenceFrames: [0] },
      report: {
        ...(makeOutcome().report ?? ({} as never)),
        frames: [{ frame: 0, psnr: 40, ssim: 0.99, passed: true, reasons: [] }],
      },
    });
    const b = makeOutcome({
      fixturePath: '/tmp/fixtures/b.json',
      manifest: { ...makeOutcome().manifest, name: 'b', referenceFrames: [0] },
      report: {
        ...(makeOutcome().report ?? ({} as never)),
        frames: [{ frame: 0, psnr: 35, ssim: 0.97, passed: true, reasons: [] }],
      },
    });
    const reader = fakeReader({
      '/tmp/fixtures/goldens/css-solid-background/frame-0.png': bytes('g'),
      '/tmp/fixtures/candidates/css-solid-background/frame-0.png': bytes('c'),
    });
    const input = await buildViewerInput([a, b], reader, { generatedAt: 'fixed' });
    expect(input.fixtures.map((f) => f.name)).toEqual(['a', 'b']);
  });
});
