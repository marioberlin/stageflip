// packages/editor-shell/src/timeline/math.test.ts
// Pins for frame ↔ pixel conversion + snap + ruler + frame labelling.
// Mirrors apps/stageflip-slide's original test file — the slide-app
// version now re-exports these symbols from editor-shell so this file
// is the one that gates the math.

import { describe, expect, it } from 'vitest';

import {
  type TimelineScale,
  formatFrameLabel,
  frameToPx,
  pxToFrame,
  rulerTickFrames,
  snapFrame,
} from './math';

const scale30fps: TimelineScale = { fps: 30, pxPerSecond: 100 };

describe('frameToPx / pxToFrame', () => {
  it('round-trips px → frame → px at integer frames', () => {
    const frame = 45;
    const px = frameToPx(frame, scale30fps);
    expect(pxToFrame(px, scale30fps)).toBe(frame);
  });

  it('frame 0 maps to px 0', () => {
    expect(frameToPx(0, scale30fps)).toBe(0);
    expect(pxToFrame(0, scale30fps)).toBe(0);
  });

  it('one second at 30 fps / 100 px/s renders at 100 px', () => {
    expect(frameToPx(30, scale30fps)).toBe(100);
  });

  it('pxToFrame clamps negative input to 0', () => {
    expect(pxToFrame(-50, scale30fps)).toBe(0);
  });

  it('scales at 60 fps / 200 px/s', () => {
    const scale: TimelineScale = { fps: 60, pxPerSecond: 200 };
    expect(frameToPx(120, scale)).toBe(400);
    expect(pxToFrame(400, scale)).toBe(120);
  });
});

describe('snapFrame', () => {
  it('rounds to the nearest increment', () => {
    expect(snapFrame(47, 15)).toBe(45);
    expect(snapFrame(53, 15)).toBe(60);
  });

  it('disables snap when the step is 0 or 1', () => {
    expect(snapFrame(47, 0)).toBe(47);
    expect(snapFrame(47.4, 1)).toBe(47);
  });
});

describe('rulerTickFrames', () => {
  it('picks a quarter-second tick when zoomed in tight', () => {
    expect(rulerTickFrames({ fps: 60, pxPerSecond: 240 })).toBe(15);
  });

  it('picks a one-second tick at a comfortable zoom', () => {
    expect(rulerTickFrames({ fps: 30, pxPerSecond: 100 })).toBe(30);
  });

  it('picks a two-second tick when zoomed out', () => {
    expect(rulerTickFrames({ fps: 30, pxPerSecond: 50 })).toBe(60);
  });

  it('picks a five-second tick when very zoomed out', () => {
    expect(rulerTickFrames({ fps: 30, pxPerSecond: 10 })).toBe(150);
  });
});

describe('formatFrameLabel', () => {
  it('renders integer seconds without a decimal', () => {
    expect(formatFrameLabel(30, 30)).toBe('1s');
    expect(formatFrameLabel(0, 30)).toBe('0s');
  });

  it('renders sub-second values with one decimal', () => {
    expect(formatFrameLabel(15, 30)).toBe('0.5s');
    expect(formatFrameLabel(75, 30)).toBe('2.5s');
  });

  it('falls back to raw frames when fps is invalid', () => {
    expect(formatFrameLabel(42, 0)).toBe('42f');
    expect(formatFrameLabel(42, Number.NaN)).toBe('42f');
  });
});
