// packages/parity/src/score.test.ts

import { describe, expect, it } from 'vitest';
import type { ParityImageData } from './image-data';
import { scoreFrames } from './score';

function solid(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): ParityImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

describe('scoreFrames', () => {
  it('returns a pass verdict when every frame meets the thresholds', () => {
    const inputs = [0, 1, 2].map((frame) => ({
      frame,
      candidate: solid(32, 32, [128, 128, 128, 255]),
      golden: solid(32, 32, [128, 128, 128, 255]),
    }));
    const report = scoreFrames(inputs);
    expect(report.passed).toBe(true);
    expect(report.failingFrames).toBe(0);
    expect(report.minSsim).toBe(1);
    expect(report.minPsnr).toBe(Number.POSITIVE_INFINITY);
    expect(report.frames).toHaveLength(3);
    expect(report.frames.every((f) => f.passed)).toBe(true);
    expect(report.reasons).toHaveLength(0);
  });

  it('flags per-frame failures with a PSNR reason', () => {
    const inputs = [
      {
        frame: 0,
        candidate: solid(32, 32, [0, 0, 0, 255]),
        golden: solid(32, 32, [200, 0, 0, 255]), // huge per-pixel error
      },
    ];
    const report = scoreFrames(inputs, { thresholds: { minPsnr: 30, minSsim: 0 } });
    expect(report.passed).toBe(false);
    expect(report.failingFrames).toBe(1);
    expect(report.frames[0]?.passed).toBe(false);
    expect(report.frames[0]?.reasons.join(',')).toMatch(/PSNR/);
    expect(report.reasons.join(',')).toMatch(/1 frame\(s\) failed; budget is 0/);
  });

  it('flags per-frame failures with an SSIM reason', () => {
    // Salt-and-pepper image vs solid grey — PSNR can stay high-ish but SSIM tanks.
    const candidate = solid(32, 32, [128, 128, 128, 255]);
    const golden = solid(32, 32, [128, 128, 128, 255]);
    for (let i = 0; i < candidate.data.length; i += 4) {
      if ((i / 4) % 2 === 0) {
        candidate.data[i] = 0;
        candidate.data[i + 1] = 0;
        candidate.data[i + 2] = 0;
      } else {
        candidate.data[i] = 255;
        candidate.data[i + 1] = 255;
        candidate.data[i + 2] = 255;
      }
    }
    const report = scoreFrames([{ frame: 0, candidate, golden }], {
      thresholds: { minPsnr: 0, minSsim: 0.97 },
    });
    expect(report.passed).toBe(false);
    expect(report.frames[0]?.reasons.join(',')).toMatch(/SSIM/);
  });

  it('passes when failing frames stay within maxFailingFrames budget', () => {
    const bad = {
      frame: 0,
      candidate: solid(16, 16, [0, 0, 0, 255]),
      golden: solid(16, 16, [200, 0, 0, 255]),
    };
    const good = {
      frame: 1,
      candidate: solid(16, 16, [128, 128, 128, 255]),
      golden: solid(16, 16, [128, 128, 128, 255]),
    };
    const report = scoreFrames([bad, good], {
      thresholds: { minPsnr: 30, minSsim: 0, maxFailingFrames: 1 },
    });
    expect(report.passed).toBe(true);
    expect(report.failingFrames).toBe(1);
  });

  it('fails when failing frames exceed maxFailingFrames budget', () => {
    const bad = {
      frame: 0,
      candidate: solid(16, 16, [0, 0, 0, 255]),
      golden: solid(16, 16, [200, 0, 0, 255]),
    };
    const report = scoreFrames([bad, bad, bad], {
      thresholds: { minPsnr: 30, minSsim: 0, maxFailingFrames: 2 },
    });
    expect(report.passed).toBe(false);
    expect(report.failingFrames).toBe(3);
  });

  it('tracks minPsnr and minSsim across the batch', () => {
    const a = {
      frame: 0,
      candidate: solid(16, 16, [128, 128, 128, 255]),
      golden: solid(16, 16, [128, 128, 128, 255]),
    };
    const b = {
      frame: 1,
      candidate: solid(16, 16, [128, 128, 128, 255]),
      golden: solid(16, 16, [130, 128, 128, 255]),
    };
    const report = scoreFrames([a, b], { thresholds: { minPsnr: 0, minSsim: 0 } });
    expect(report.minPsnr).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(report.minSsim).toBeLessThan(1);
  });

  it('narrows scoring to a region when provided on the input', () => {
    // Golden is solid grey; candidate has a black stripe in the top-left quadrant.
    const golden = solid(32, 32, [128, 128, 128, 255]);
    const candidate = solid(32, 32, [128, 128, 128, 255]);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const off = (y * 32 + x) * 4;
        candidate.data[off] = 0;
        candidate.data[off + 1] = 0;
        candidate.data[off + 2] = 0;
      }
    }
    const focusBad = scoreFrames(
      [
        {
          frame: 0,
          candidate,
          golden,
          region: { x: 0, y: 0, width: 16, height: 16 },
        },
      ],
      { thresholds: { minPsnr: 30, minSsim: 0.97 } },
    );
    const focusGood = scoreFrames(
      [
        {
          frame: 0,
          candidate,
          golden,
          region: { x: 16, y: 16, width: 16, height: 16 },
        },
      ],
      { thresholds: { minPsnr: 30, minSsim: 0.97 } },
    );
    expect(focusBad.passed).toBe(false);
    expect(focusGood.passed).toBe(true);
    expect(focusGood.minSsim).toBe(1);
  });

  it('produces an empty-batch report with trivially-passing aggregates', () => {
    const report = scoreFrames([]);
    expect(report.frames).toHaveLength(0);
    expect(report.failingFrames).toBe(0);
    expect(report.minPsnr).toBe(Number.POSITIVE_INFINITY);
    expect(report.minSsim).toBe(1);
    expect(report.passed).toBe(true);
  });

  it('surfaces the resolved thresholds in the report', () => {
    const report = scoreFrames([], { thresholds: { minPsnr: 42 } });
    expect(report.thresholds.minPsnr).toBe(42);
    expect(report.thresholds.minSsim).toBe(0.97);
  });
});
