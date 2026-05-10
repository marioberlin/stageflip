// packages/runtimes/frame-runtime-bridge/src/clips/grain.test.tsx
// T-321a — Grain clip behaviour + propsSchema + hash mixer +
// synthesized-noise determinism. Mirrors the structural posture of
// `qr-code-bounce.test.tsx` and `link-sticker.test.tsx` (single-object
// schema, no `discriminatedUnion`, closed-form animation math, byte-
// stable render output).

import { FrameProvider } from '@stageflip/frame-runtime';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// Import the barrel first to avoid the circular-import order issue
// (mirrors the workaround documented in `qr-code-bounce.test.tsx` /
// `link-sticker.test.tsx` / sibling tests): the barrel pulls in every
// clip module before this test's direct `./grain.js` import is
// dereferenced, so `ALL_BRIDGE_CLIPS` is fully populated when read.
import {
  ALL_BRIDGE_CLIPS,
  Grain,
  type GrainProps,
  grainClip,
  grainPropsSchema,
  hash,
  luminanceOffset,
  synthesizeNoiseBytes,
} from './index.js';

afterEach(cleanup);

const MIN_PROPS: GrainProps = {};

function renderAt(
  frame: number,
  props: GrainProps,
  config: { width?: number; height?: number; fps?: number; durationInFrames?: number } = {},
) {
  // Cluster D canon — 24 fps cinematic; Stranger Things canonical
  // 50 s @ 24 fps = 1200 frames; 1920 × 1080 16:9 cinematic.
  const { width = 1920, height = 1080, fps = 24, durationInFrames = 1200 } = config;
  return render(
    <FrameProvider frame={frame} config={{ width, height, fps, durationInFrames }}>
      <Grain {...props} />
    </FrameProvider>,
  );
}

describe('grainPropsSchema — minimal inputs', () => {
  it('accepts minimal valid input ({}) — all fields optional', () => {
    expect(grainPropsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts full valid input', () => {
    expect(
      grainPropsSchema.safeParse({
        intensity: 0.5,
        cellSize: 4,
        seed: 42,
        position: { x: 0, y: 0, width: 1920, height: 1080 },
      }).success,
    ).toBe(true);
  });
});

describe('grainPropsSchema — field rejections', () => {
  it('rejects out-of-range intensity (< 0 or > 1)', () => {
    expect(grainPropsSchema.safeParse({ intensity: -0.1 }).success).toBe(false);
    expect(grainPropsSchema.safeParse({ intensity: 1.1 }).success).toBe(false);
    expect(grainPropsSchema.safeParse({ intensity: 0 }).success).toBe(true);
    expect(grainPropsSchema.safeParse({ intensity: 1 }).success).toBe(true);
  });

  it('rejects out-of-range or non-integer cellSize', () => {
    expect(grainPropsSchema.safeParse({ cellSize: 0 }).success).toBe(false);
    expect(grainPropsSchema.safeParse({ cellSize: 17 }).success).toBe(false);
    expect(grainPropsSchema.safeParse({ cellSize: 1.5 }).success).toBe(false);
    expect(grainPropsSchema.safeParse({ cellSize: 1 }).success).toBe(true);
    expect(grainPropsSchema.safeParse({ cellSize: 16 }).success).toBe(true);
  });

  it('rejects non-integer seed', () => {
    expect(grainPropsSchema.safeParse({ seed: 1.5 }).success).toBe(false);
    expect(grainPropsSchema.safeParse({ seed: 0 }).success).toBe(true);
    expect(grainPropsSchema.safeParse({ seed: -42 }).success).toBe(true);
  });

  it('rejects out-of-range position', () => {
    expect(
      grainPropsSchema.safeParse({ position: { x: 0, y: 0, width: 0, height: 1080 } }).success,
    ).toBe(false);
    expect(
      grainPropsSchema.safeParse({ position: { x: 0, y: 0, width: 1921, height: 1080 } }).success,
    ).toBe(false);
    expect(
      grainPropsSchema.safeParse({ position: { x: 0, y: 0, width: 1920, height: 1081 } }).success,
    ).toBe(false);
    expect(
      grainPropsSchema.safeParse({ position: { x: 0, y: 0, width: 1920, height: 0 } }).success,
    ).toBe(false);
  });

  it('rejects extra unknown field (strict mode)', () => {
    expect(
      grainPropsSchema.safeParse({
        intensity: 0.2,
        mystery: true,
      }).success,
    ).toBe(false);
  });
});

describe('hash — closed-form integer mixer', () => {
  it('is deterministic — same inputs yield same uint8 output across calls', () => {
    expect(hash(10, 20, 100, 0)).toBe(hash(10, 20, 100, 0));
    expect(hash(0, 0, 0, 0)).toBe(hash(0, 0, 0, 0));
    expect(hash(1920, 1080, 1199, 42)).toBe(hash(1920, 1080, 1199, 42));
  });

  it('produces a uint8 in [0, 255]', () => {
    for (let f = 0; f < 32; f += 1) {
      const v = hash(f * 7, f * 13, f * 31, 0);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('animates across frames — at least one (x, y, seed) shifts byte between adjacent frames', () => {
    // Hash collisions are statistically possible (~1/256). Scan a small
    // grid until we find a known-distinct pair so this test stays
    // deterministic without relying on a single hand-picked tuple.
    let foundShift = false;
    for (let x = 0; x < 8 && !foundShift; x += 1) {
      for (let y = 0; y < 8 && !foundShift; y += 1) {
        if (hash(x, y, 100, 0) !== hash(x, y, 101, 0)) {
          foundShift = true;
        }
      }
    }
    expect(foundShift).toBe(true);
  });

  it('decorrelates across seeds — at least one tuple differs between seeds 0 and 1', () => {
    let foundShift = false;
    for (let x = 0; x < 8 && !foundShift; x += 1) {
      for (let y = 0; y < 8 && !foundShift; y += 1) {
        if (hash(x, y, 100, 0) !== hash(x, y, 100, 1)) {
          foundShift = true;
        }
      }
    }
    expect(foundShift).toBe(true);
  });
});

describe('luminanceOffset', () => {
  it('returns 0 at hash byte 127.5 (mid-luminance no-op)', () => {
    // hash byte = 0 → offset = -intensity * 255; byte = 255 → +intensity * 255.
    // At byte 127.5 (impossible for int output but exposes the formula),
    // the offset is exactly 0. We probe via the closed-form expression.
    expect(luminanceOffset(0, 0.5)).toBeCloseTo(-127.5, 5);
    expect(luminanceOffset(255, 0.5)).toBeCloseTo(127.5, 5);
  });

  it('scales with intensity — zero intensity yields zero offset', () => {
    // `((0 / 255) - 0.5) * 2 * 0 * 255 === -0` in IEEE 754; treat ±0 as
    // equivalent via Math.abs (the render path's `Math.round(128 + 0)`
    // collapses both to 128 anyway).
    expect(Math.abs(luminanceOffset(0, 0))).toBe(0);
    expect(Math.abs(luminanceOffset(255, 0))).toBe(0);
  });
});

describe('synthesizeNoiseBytes — cell-based blocky noise', () => {
  it('produces RGBA byte length width × height × 4', () => {
    const data = synthesizeNoiseBytes(8, 4, 0, 0, 0.5, 1);
    expect(data.length).toBe(8 * 4 * 4);
  });

  it('shares one noise byte across each cellSize × cellSize tile', () => {
    // cellSize 4 → pixels (0,0) and (3,3) live in cell (0,0); pixel (4,4) lives in cell (1,1).
    const data = synthesizeNoiseBytes(8, 8, 0, 0, 1, 4);
    const at = (px: number, py: number): number => data[(py * 8 + px) * 4] ?? -1;
    expect(at(0, 0)).toBe(at(3, 3));
    expect(at(0, 0)).toBe(at(2, 1));
    // Cell (1, 1) starts at (4, 4); should differ from cell (0, 0) for at
    // least one cellSize choice. Hash collision is statistically possible
    // (~1/256), but with intensity 1 + cellSize 4 the offset spans the
    // full ±127.5 range so the channel value is sensitive to byte changes.
    let crossCellDiffers = false;
    for (let cellSize = 2; cellSize <= 8 && !crossCellDiffers; cellSize += 1) {
      const probe = synthesizeNoiseBytes(16, 16, 0, 0, 1, cellSize);
      const a = probe[(0 * 16 + 0) * 4] ?? -1;
      const b = probe[(cellSize * 16 + cellSize) * 4] ?? -1;
      if (a !== b) crossCellDiffers = true;
    }
    expect(crossCellDiffers).toBe(true);
  });

  it('sets alpha = round(intensity * 255) on every pixel', () => {
    const data = synthesizeNoiseBytes(4, 4, 0, 0, 0.5, 1);
    const expectedAlpha = Math.round(0.5 * 255);
    for (let i = 3; i < data.length; i += 4) {
      expect(data[i]).toBe(expectedAlpha);
    }
  });

  it('writes R = G = B (luminance-only) on every pixel', () => {
    const data = synthesizeNoiseBytes(4, 4, 0, 0, 0.5, 1);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1]);
      expect(data[i]).toBe(data[i + 2]);
    }
  });

  it('is deterministic — same inputs yield byte-identical Uint8ClampedArray', () => {
    const a = synthesizeNoiseBytes(32, 32, 60, 0, 0.15, 1);
    const b = synthesizeNoiseBytes(32, 32, 60, 0, 0.15, 1);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]).toBe(b[i]);
    }
  });

  it('shifts the noise field across frames — at least one byte changes between adjacent frames', () => {
    const a = synthesizeNoiseBytes(32, 32, 60, 0, 0.5, 1);
    const b = synthesizeNoiseBytes(32, 32, 61, 0, 0.5, 1);
    let differ = false;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== b[i]) {
        differ = true;
        break;
      }
    }
    expect(differ).toBe(true);
  });
});

describe('<Grain> render', () => {
  it('renders an absolutely-positioned <canvas> at the configured region', () => {
    renderAt(0, { position: { x: 100, y: 200, width: 320, height: 240 } });
    const canvas = screen.getByTestId('grain') as HTMLCanvasElement;
    expect(canvas.tagName).toBe('CANVAS');
    expect(canvas.style.left).toBe('100px');
    expect(canvas.style.top).toBe('200px');
    expect(canvas.style.width).toBe('320px');
    expect(canvas.style.height).toBe('240px');
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
  });

  it('fills the full canvas when position is absent (defaults via useVideoConfig)', () => {
    renderAt(0, MIN_PROPS);
    const canvas = screen.getByTestId('grain') as HTMLCanvasElement;
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(canvas.style.left).toBe('0px');
    expect(canvas.style.top).toBe('0px');
  });

  it('records intensity / cellSize / seed on the canvas dataset', () => {
    renderAt(0, { intensity: 0.3, cellSize: 4, seed: 42 });
    const canvas = screen.getByTestId('grain') as HTMLCanvasElement;
    expect(canvas.dataset.intensity).toBe('0.3');
    expect(canvas.dataset.cellSize).toBe('4');
    expect(canvas.dataset.seed).toBe('42');
  });

  it('applies default intensity / cellSize / seed when props absent', () => {
    renderAt(0, MIN_PROPS);
    const canvas = screen.getByTestId('grain') as HTMLCanvasElement;
    expect(canvas.dataset.intensity).toBe('0.15');
    expect(canvas.dataset.cellSize).toBe('1');
    expect(canvas.dataset.seed).toBe('0');
  });
});

describe('clip registration', () => {
  it('registers as kind "grain" and is in ALL_BRIDGE_CLIPS at length 61', () => {
    expect(grainClip.kind).toBe('grain');
    expect(ALL_BRIDGE_CLIPS).toHaveLength(61);
    expect(ALL_BRIDGE_CLIPS).toContain(grainClip);
  });

  it('declares no fontRequirements (per D-T321a — no text surface)', () => {
    expect(grainClip.fontRequirements).toBeUndefined();
  });

  it('declares empty themeSlots (per D-T321a-8 — luminance-only grain has no color surface)', () => {
    expect(grainClip.themeSlots).toEqual({});
  });
});

describe('determinism', () => {
  it('synthesizes byte-identical noise bytes for the same props at the same frame', () => {
    const a = synthesizeNoiseBytes(64, 64, 60, 0, 0.15, 1);
    const b = synthesizeNoiseBytes(64, 64, 60, 0, 0.15, 1);
    expect(a).toEqual(b);
  });

  it('renders byte-identical DOM markup for the same props at the same frame', () => {
    const { container: a } = renderAt(60, MIN_PROPS);
    const htmlA = a.innerHTML;
    cleanup();
    const { container: b } = renderAt(60, MIN_PROPS);
    const htmlB = b.innerHTML;
    expect(htmlA).toBe(htmlB);
  });
});
