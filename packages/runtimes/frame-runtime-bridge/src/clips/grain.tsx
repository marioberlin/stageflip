// packages/runtimes/frame-runtime-bridge/src/clips/grain.tsx
// T-321a — `grain` runtime-clip primitive: deterministic per-pixel
// film-grain noise overlay computed from `(x, y, frame, seed)` via a
// closed-form integer hash (xxhash32-style mixer using `Math.imul` and
// `>>>` for bit-exact 32-bit arithmetic across V8 versions). First of
// five T-321 carve-outs (T-321a grain → T-321b lightLeak → T-321c
// particles → T-321d photographic-overlay → T-321 ThreeSceneClip
// integration). Single Zod `object().strict()` schema (NO
// `discriminatedUnion`, NO style enum, NO phase enum, NO theme slots,
// NO font surface) with all-optional props (`intensity`, `cellSize`,
// `seed`, `position`); the canonical Stranger Things-grade subtle grain
// renders with zero props. Animated grain via frame-derived noise field
// — each frame's noise values derive from `(x, y, frame, seed)`, so the
// frame counter shifts the field every frame producing the perceived
// "moving grain" register. Always-animated; no static-mode opt-out in
// v1. Renders via a single `<canvas>` with `useEffect`-driven
// `ImageData` write (per D-T321a-5 — SVG `<feTurbulence>` rejected for
// cross-CDP determinism hazard; per-pixel `<rect>` matrix rejected
// outright for DOM-size cost). Mandatory for T-348
// `stranger-things-benguiat` per its compass canon line 45 ("Optical
// film grain is mandatory; clean digital looks wrong"); reusable across
// Cluster D presets (T-348 stranger-things, T-351 true-detective, T-353
// severance) without coupling grain logic to the titleSequence
// primitive. v1 ships luminance-only grain at a single intensity /
// cellSize / seed; tinted grain (T-321a-tint), blue-noise tile / Perlin
// / simplex models (T-321a-noise-quality), multi-octave (T-321a-octaves),
// and ramped intensity (T-321a-ramp) defer. Acceptance bar at the
// preset level is PSNR ≥ 36 dB / SSIM ≥ 0.92 (lower than cluster-norm
// 42/0.98 — film grain by definition reduces compression precision; per
// D-T321a-12). Frame-deterministic — no `Date.now` / `Math.random` /
// `crypto.randomUUID` / `setTimeout` / `setInterval` / `fetch` /
// `requestAnimationFrame` / `addEventListener`. The `useEffect` is a
// pure function of `(frame, props)` writing the hash output to canvas
// pixels via `ctx.putImageData(...)`; same `(frame, props)` →
// byte-identical pixel data.

import { useCurrentFrame, useVideoConfig } from '@stageflip/frame-runtime';
import type { ClipDefinition } from '@stageflip/runtimes-contract';
import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

// ─── schema ──────────────────────────────────────────────────────────────

const positionSchema = z
  .object({
    /** Absolute pixel x within the canvas (top-left of grain region). */
    x: z.number(),
    /** Absolute pixel y within the canvas (top-left of grain region). */
    y: z.number(),
    /** Width of the grain region in canvas pixels (1..1920). */
    width: z.number().positive().min(1).max(1920),
    /** Height of the grain region in canvas pixels (1..1080). */
    height: z.number().positive().min(1).max(1080),
  })
  .strict();

export const grainPropsSchema = z
  .object({
    /**
     * Grain intensity ∈ [0, 1]. 0 = no grain; 1 = full-amplitude white-
     * noise per cell. Default 0.15 (canonical Stranger Things-grade
     * subtle grain).
     */
    intensity: z.number().min(0).max(1).optional(),
    /**
     * Cell size in canvas pixels. 1 = per-pixel noise; higher = blockier
     * grain. Default 1.
     */
    cellSize: z.number().int().positive().min(1).max(16).optional(),
    /**
     * Integer seed for the hash mixer. Default 0. Different seeds yield
     * decorrelated noise fields — useful for compositing two grain
     * layers without correlated peaks.
     */
    seed: z.number().int().optional(),
    /**
     * Optional region. When absent, defaults at runtime to the full
     * canvas (`{ x: 0, y: 0, width: useVideoConfig().width, height:
     * useVideoConfig().height }`).
     */
    position: positionSchema.optional(),
  })
  .strict();

export type GrainProps = z.infer<typeof grainPropsSchema>;

// ─── constants ───────────────────────────────────────────────────────────

const DEFAULT_INTENSITY = 0.15;
const DEFAULT_CELL_SIZE = 1;
const DEFAULT_SEED = 0;

// ─── pure helpers — deterministic integer hash mixer ────────────────────

/**
 * Closed-form integer hash mixer (xxhash32-style). Pure 32-bit integer
 * arithmetic via `Math.imul` (specified bit-exact across V8 versions
 * by ECMAScript) and `>>>` (unsigned coercion). NO `Math.random`, NO
 * `Date.now`, NO `crypto.subtle`. Output is uint8 ∈ [0, 255].
 *
 * The mixer applies three multiplicative rounds with xor-shift
 * avalanche steps. Multiplier constants are large odd primes selected
 * for good avalanche; they match the constants in the T-321a spec
 * (D-T321a-4) and are themselves derived from the xxhash32 reference.
 *
 * Determinism contract: same `(x, y, frame, seed)` → same uint8.
 */
export function hash(x: number, y: number, frame: number, seed: number): number {
  let h = (seed | 0) >>> 0;
  h = Math.imul(h ^ (x | 0), 374761393) >>> 0;
  h = Math.imul(h ^ (y | 0), 668265263) >>> 0;
  h = Math.imul(h ^ (frame | 0), 1597334677) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h & 0xff;
}

/**
 * Compute the signed luminance offset for a hash byte at the given
 * intensity. `offset = ((hash / 255) - 0.5) * 2 * intensity * 255`,
 * yielding a signed value in `[-intensity * 255, +intensity * 255]`.
 * Pure function. The render path snaps to integer via `Math.round` at
 * the final pixel write to avoid float drift.
 */
export function luminanceOffset(noise: number, intensity: number): number {
  return (noise / 255 - 0.5) * 2 * intensity * 255;
}

// ─── pure helpers — ImageData synthesis ──────────────────────────────────

/**
 * Synthesize the per-pixel noise `Uint8ClampedArray` for a region of
 * `width × height` pixels at `frame` using the configured `seed`,
 * `intensity`, and `cellSize`. Pure function — same inputs always
 * produce byte-identical output. Cell-based blocky noise (when
 * `cellSize > 1`) shares one hash byte across each `cellSize × cellSize`
 * tile via `Math.floor(px / cellSize)` cell-coordinate division.
 *
 * Returned array layout: row-major RGBA (`width * height * 4` bytes),
 * suitable for `new ImageData(data, width, height)` and
 * `ctx.putImageData(...)`. Every pixel writes
 * `R = G = B = round(128 + offset)` (luminance-only) and
 * `A = round(intensity * 255)`. The `Uint8ClampedArray` itself clamps
 * channel values to `[0, 255]`; `Math.round` at the write site avoids
 * float-drift hazards in any subsequent diffs.
 */
export function synthesizeNoiseBytes(
  width: number,
  height: number,
  frame: number,
  seed: number,
  intensity: number,
  cellSize: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const alpha = Math.round(intensity * 255);
  for (let py = 0; py < height; py += 1) {
    const cy = Math.floor(py / cellSize);
    for (let px = 0; px < width; px += 1) {
      const cx = Math.floor(px / cellSize);
      const noise = hash(cx, cy, frame, seed);
      const offset = luminanceOffset(noise, intensity);
      const channel = Math.round(128 + offset);
      const i = (py * width + px) * 4;
      data[i] = channel; // R
      data[i + 1] = channel; // G
      data[i + 2] = channel; // B
      data[i + 3] = alpha;
    }
  }
  return data;
}

// ─── component ───────────────────────────────────────────────────────────

/**
 * `<Grain>` — the public component. Renders a deterministic per-pixel
 * film-grain noise overlay computed from `(x, y, frame, seed)`. Frame-
 * derived; v1 always-animated (no static mode). Defaults to full-canvas
 * region when `position` absent. The `useEffect` is a pure function of
 * `(frame, intensity, cellSize, seed, position)` — no timers, no async
 * work, no event listeners; the canvas write via `ctx.putImageData(...)`
 * is the only side effect.
 */
export function Grain(props: GrainProps): ReactElement {
  const frame = useCurrentFrame();
  const { width: canvasW, height: canvasH } = useVideoConfig();

  const intensity = props.intensity ?? DEFAULT_INTENSITY;
  const cellSize = props.cellSize ?? DEFAULT_CELL_SIZE;
  const seed = props.seed ?? DEFAULT_SEED;

  const region = props.position ?? {
    x: 0,
    y: 0,
    width: canvasW,
    height: canvasH,
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const data = synthesizeNoiseBytes(
      region.width,
      region.height,
      frame,
      seed,
      intensity,
      cellSize,
    );
    const image = new ImageData(data, region.width, region.height);
    ctx.putImageData(image, 0, 0);
  }, [frame, seed, intensity, cellSize, region.width, region.height]);

  const style: CSSProperties = {
    position: 'absolute',
    left: region.x,
    top: region.y,
    width: region.width,
    height: region.height,
    pointerEvents: 'none',
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="grain"
      data-intensity={intensity}
      data-cell-size={cellSize}
      data-seed={seed}
      width={region.width}
      height={region.height}
      style={style}
    />
  );
}

/**
 * `grainClip` clip definition — registered as `kind: 'grain'` in the
 * frame-runtime bridge. NO theme slots (per D-T321a-8 — luminance-only
 * grain has no color surface; tinted grain may register slots in
 * T-321a-tint follow-up). NO `fontRequirements` (per D-T321a — grain
 * has no text surface).
 */
export const grainClip: ClipDefinition<unknown> = defineFrameClip<GrainProps>({
  kind: 'grain',
  component: Grain,
  propsSchema: grainPropsSchema,
  themeSlots: {},
});
