// packages/runtimes/audience/src/clips/heatmap/rasterize.ts
// T-469 — Pure deterministic helper that rasterises a heatmap from a
// frozen taps array to an `ImageData` buffer suitable for
// `CanvasRenderingContext2D.putImageData(...)`.
//
// Pipeline (per ADR-010 §D4 + the T-469 spec):
//   1. Accumulate per-tap weight into a `Float32Array(gridW * gridH)`
//      using a Gaussian splat (σ = 2 cells; iterate ±3σ around the
//      centre). Weight = `tap.intensity` (defaults to 1 at the protocol
//      layer).
//   2. Normalise the grid to [0..1] via division by the max value.
//   3. Upsample to canvas dimensions using nearest-neighbour mapping —
//      keeps the output byte-deterministic; bilinear introduces
//      floating-point drift across implementations.
//   4. Colormap each upsampled value into RGB using a 4-bucket
//      piecewise-linear ramp (blue → green → yellow → red); alpha is
//      `value * 255 * 0.7` so the layer composites at ~70% opacity over
//      the underlying image.
//
// Determinism (CLAUDE.md §3): no `Math.random`, no `Date.now`, no
// `setTimeout`, no `fetch`. Only arithmetic + `Math.exp` (which is
// IEEE-754 deterministic across reasonable engines for the inputs we
// pass).
//
// Browser-safe — depends on the host `ImageData` constructor (jsdom +
// happy-dom both provide it; native browsers natively do).

/**
 * Resolve the host `ImageData` constructor. Browsers + jsdom-like
 * environments expose `globalThis.ImageData`; test environments
 * (happy-dom in this monorepo) don't, so we install a minimal-shape
 * stand-in that satisfies the `ImageData` structural contract
 * (`{ data, width, height, colorSpace }`) and is interoperable with
 * `CanvasRenderingContext2D.putImageData(...)` everywhere that the
 * underlying canvas accepts the object via duck-typing.
 *
 * The stand-in is INTENTIONALLY untyped externally — at runtime in a
 * real browser the global `ImageData` is the spec-compliant DOM class
 * and this branch never fires.
 */
function makeImageData(rgba: Uint8ClampedArray, width: number, height: number): ImageData {
  const ImageDataCtor = (
    globalThis as unknown as {
      readonly ImageData?: new (data: Uint8ClampedArray, w: number, h: number) => ImageData;
    }
  ).ImageData;
  if (typeof ImageDataCtor === 'function') {
    return new ImageDataCtor(rgba, width, height);
  }
  // Minimal structural stand-in for test environments without a DOM
  // canvas implementation (happy-dom). Real browser code never reaches
  // this branch — `globalThis.ImageData` is always defined in a DOM.
  return { data: rgba, width, height, colorSpace: 'srgb' } as unknown as ImageData;
}

/** Sigma of the Gaussian kernel, in grid cells. */
const KERNEL_SIGMA_CELLS = 2;
/** Iterate the kernel out to ±3σ. */
const KERNEL_HALF_SPAN_CELLS = 3 * KERNEL_SIGMA_CELLS;
/** Max alpha cap — `0.7 * 255` rounded down to the nearest integer. */
const MAX_ALPHA = 178;

/**
 * One tap entry. Matches the `HeatmapAggregation.taps[i]` contract
 * from `@stageflip/audience-contract` (x + y normalised to [0..1];
 * intensity positive).
 */
export interface RasterizeTap {
  readonly x: number;
  readonly y: number;
  readonly intensity: number;
}

/** Grid resolution for the accumulation buffer. */
export interface RasterizeGridResolution {
  readonly w: number;
  readonly h: number;
}

/**
 * Linear-interpolate two integer channel values by `t ∈ [0, 1]`.
 * Result is rounded to the nearest integer.
 */
function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/**
 * Colormap a normalised value `v ∈ [0, 1]` to an RGB triple via a
 * 4-bucket piecewise-linear ramp:
 *   - `[0.00, 0.25]` — blue   (0,   0, 255)  → green  (0, 255, 0)
 *   - `[0.25, 0.50]` — green  (0, 255,   0)  → yellow (255, 255, 0)
 *   - `[0.50, 0.75]` — yellow (255, 255,  0) → red    (255,   0, 0)
 *   - `[0.75, 1.00]` — red    (255,   0,  0) → red    (255,   0, 0)
 */
function colormap(v: number): readonly [number, number, number] {
  if (v <= 0) return [0, 0, 0];
  if (v >= 1) return [255, 0, 0];
  if (v < 0.25) {
    const t = v / 0.25;
    return [0, lerp(0, 255, t), lerp(255, 0, t)];
  }
  if (v < 0.5) {
    const t = (v - 0.25) / 0.25;
    return [lerp(0, 255, t), 255, 0];
  }
  if (v < 0.75) {
    const t = (v - 0.5) / 0.25;
    return [255, lerp(255, 0, t), 0];
  }
  return [255, 0, 0];
}

/**
 * Rasterise a heatmap from a frozen taps array.
 *
 * Pure: given identical `(taps, gridResolution, canvasWidth,
 * canvasHeight)` the returned `ImageData.data` bytes are bit-identical.
 *
 * @param taps          per-tap (x, y, intensity); x + y normalised to [0..1].
 * @param gridResolution accumulation grid resolution (typically 32x32).
 * @param canvasWidth   output canvas width in pixels.
 * @param canvasHeight  output canvas height in pixels.
 * @returns             `ImageData` of `canvasWidth × canvasHeight` RGBA pixels.
 */
export function rasterizeHeatmap(
  taps: readonly RasterizeTap[],
  gridResolution: RasterizeGridResolution,
  canvasWidth: number,
  canvasHeight: number,
): ImageData {
  const { w: gridW, h: gridH } = gridResolution;
  const grid = new Float32Array(gridW * gridH);

  // ---- 1. Gaussian-kernel splat per tap into the grid. ----
  const sigma = KERNEL_SIGMA_CELLS;
  const twoSigmaSq = 2 * sigma * sigma;
  for (const tap of taps) {
    const cx = tap.x * gridW;
    const cy = tap.y * gridH;
    const weight = tap.intensity;
    const x0 = Math.max(0, Math.floor(cx - KERNEL_HALF_SPAN_CELLS));
    const x1 = Math.min(gridW - 1, Math.ceil(cx + KERNEL_HALF_SPAN_CELLS));
    const y0 = Math.max(0, Math.floor(cy - KERNEL_HALF_SPAN_CELLS));
    const y1 = Math.min(gridH - 1, Math.ceil(cy + KERNEL_HALF_SPAN_CELLS));
    for (let gy = y0; gy <= y1; gy += 1) {
      const dy = gy + 0.5 - cy;
      for (let gx = x0; gx <= x1; gx += 1) {
        const dx = gx + 0.5 - cx;
        const distSq = dx * dx + dy * dy;
        const g = Math.exp(-distSq / twoSigmaSq);
        const idx = gy * gridW + gx;
        grid[idx] = (grid[idx] ?? 0) + weight * g;
      }
    }
  }

  // ---- 2. Normalise the grid to [0..1]. ----
  let maxValue = 0;
  for (let i = 0; i < grid.length; i += 1) {
    const v = grid[i] ?? 0;
    if (v > maxValue) maxValue = v;
  }

  // ---- 3 + 4. Upsample (nearest-neighbour) + colormap into the rgba buffer. ----
  const rgba = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
  if (maxValue <= 0) {
    return makeImageData(rgba, canvasWidth, canvasHeight);
  }
  const invMax = 1 / maxValue;
  for (let py = 0; py < canvasHeight; py += 1) {
    const gy = Math.min(gridH - 1, Math.floor((py / canvasHeight) * gridH));
    for (let px = 0; px < canvasWidth; px += 1) {
      const gx = Math.min(gridW - 1, Math.floor((px / canvasWidth) * gridW));
      const raw = grid[gy * gridW + gx] ?? 0;
      const v = raw * invMax;
      const [r, g, b] = colormap(v);
      const alpha = Math.min(MAX_ALPHA, Math.round(v * 255 * 0.7));
      const offset = (py * canvasWidth + px) * 4;
      rgba[offset] = r;
      rgba[offset + 1] = g;
      rgba[offset + 2] = b;
      rgba[offset + 3] = alpha;
    }
  }
  return makeImageData(rgba, canvasWidth, canvasHeight);
}
