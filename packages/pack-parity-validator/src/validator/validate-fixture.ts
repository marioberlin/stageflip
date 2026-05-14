// packages/pack-parity-validator/src/validator/validate-fixture.ts
// T-549 — Single-fixture validator. Pure synchronous function: takes a
// candidate + reference PNG byte buffer and a cluster id, decodes both,
// scores PSNR + SSIM, and returns a structured result.
//
// PSNR is computed exactly per the standard formula:
//   20 * log10(MAX_I) - 10 * log10(MSE)   with MAX_I = 255
// equivalent to 10 * log10(MAX_I^2 / MSE) which we use for numerical
// parity with `@stageflip/parity`.
//
// SSIM ships as a simplified per-pixel mean-luminance + variance
// comparator over 8x8 blocks (no Gaussian window). The trade-off vs the
// canonical Wang-2004 implementation: our score sits within ~1e-2 of
// `ssim.js` mssim on identical buffers (1.0 exactly) and on uniform
// noise. Pack-parity validation cares about gross drift (rendered-blank,
// ~30 dB PSNR drops), not pixel-perfect parity with the workspace
// fixture scorer; the simplified SSIM is sufficient for the gate.
//
// The full workspace scorer (`@stageflip/parity`) wraps `ssim.js` and
// remains the reference implementation for in-tree parity; this package
// is host-side gating that runs at marketplace publish + pack install.

import { PNG } from 'pngjs';
import {
  type ClusterPsnrThreshold,
  getClusterThreshold,
  resolveClusterThreshold,
} from '../thresholds/cluster-thresholds.js';

/** RGBA image-data shape — row-major, 8 bits per channel. */
interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export type FixtureValidationReason =
  | 'psnr-below-threshold'
  | 'ssim-below-threshold'
  | 'unknown-cluster'
  | 'malformed-png'
  | 'dimension-mismatch';

export interface FixtureValidationInput {
  readonly clusterId: string;
  readonly actualPngBytes: Uint8Array;
  readonly referencePngBytes: Uint8Array;
}

export interface FixtureValidationResult {
  readonly ok: boolean;
  readonly psnr: number;
  readonly ssim: number;
  readonly threshold: ClusterPsnrThreshold;
  readonly reason?: FixtureValidationReason;
}

/**
 * Validate a single pack-shipped parity fixture against its cluster
 * threshold. Pure: no IO, no clock, no network. Decoding failures
 * surface as a result with `reason: 'malformed-png'` rather than
 * throwing — the validator is a gate; callers want a structured verdict.
 */
export function validateFixture(input: FixtureValidationInput): FixtureValidationResult {
  const directThreshold = getClusterThreshold(input.clusterId);
  // Unknown cluster → score against default but flag the reason. The
  // gate still computes the metrics so the report has data to display.
  const threshold = directThreshold ?? resolveClusterThreshold(input.clusterId);

  let actual: DecodedImage;
  let reference: DecodedImage;
  try {
    actual = decodePng(input.actualPngBytes);
    reference = decodePng(input.referencePngBytes);
  } catch {
    return {
      ok: false,
      psnr: 0,
      ssim: 0,
      threshold,
      reason: 'malformed-png',
    };
  }

  if (actual.width !== reference.width || actual.height !== reference.height) {
    return {
      ok: false,
      psnr: 0,
      ssim: 0,
      threshold,
      reason: 'dimension-mismatch',
    };
  }

  const psnrValue = computePsnr(actual, reference);
  const ssimValue = computeSimplifiedSsim(actual, reference);

  if (!directThreshold) {
    return {
      ok: false,
      psnr: psnrValue,
      ssim: ssimValue,
      threshold,
      reason: 'unknown-cluster',
    };
  }
  if (psnrValue < threshold.minPsnr) {
    return {
      ok: false,
      psnr: psnrValue,
      ssim: ssimValue,
      threshold,
      reason: 'psnr-below-threshold',
    };
  }
  if (ssimValue < threshold.minSsim) {
    return {
      ok: false,
      psnr: psnrValue,
      ssim: ssimValue,
      threshold,
      reason: 'ssim-below-threshold',
    };
  }
  return {
    ok: true,
    psnr: psnrValue,
    ssim: ssimValue,
    threshold,
  };
}

/**
 * Decode a PNG byte buffer into RGBA image-data. Throws on malformed
 * input — callers wrap and translate to a `'malformed-png'` reason.
 */
function decodePng(bytes: Uint8Array): DecodedImage {
  // pngjs accepts a Buffer; copy if we got a non-Buffer Uint8Array.
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  // Synchronous decode via PNG.sync.read keeps the validator
  // synchronous + pure — no Promise plumbing in the public surface.
  const decoded = PNG.sync.read(buf);
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
  };
}

/**
 * PSNR (dB) over the RGB channels (alpha ignored — pack fixtures are
 * always rendered fully opaque). Mirrors `@stageflip/parity` so a pack
 * scoring cleanly here also scores cleanly under the workspace harness.
 */
function computePsnr(a: DecodedImage, b: DecodedImage): number {
  const pixels = a.width * a.height;
  if (pixels === 0) return Number.POSITIVE_INFINITY;
  let sumSquaredError = 0;
  const end = a.data.length;
  for (let i = 0; i < end; i += 4) {
    const dr = (a.data[i] ?? 0) - (b.data[i] ?? 0);
    const dg = (a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0);
    const db = (a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0);
    sumSquaredError += dr * dr + dg * dg + db * db;
  }
  if (sumSquaredError === 0) return Number.POSITIVE_INFINITY;
  const channels = 3;
  const mse = sumSquaredError / (pixels * channels);
  const MAX = 255;
  return 10 * Math.log10((MAX * MAX) / mse);
}

/**
 * Simplified SSIM over 8x8 luminance blocks. Returns the mean of the
 * per-block SSIM scores; identical inputs return exactly 1.0.
 *
 * The canonical Wang-2004 SSIM uses a Gaussian-weighted 11x11 window
 * and full luminance / contrast / structure decomposition. We ship a
 * uniform-window 8x8 variant because (a) pack-parity validation gates
 * gross drift, not sub-pixel parity, and (b) avoiding the `ssim.js`
 * dependency keeps this package's transitive footprint minimal — the
 * marketplace publish handler (T-550) and the pack-loader install gate
 * both want the smallest possible bundle to run server-side.
 */
function computeSimplifiedSsim(a: DecodedImage, b: DecodedImage): number {
  if (a.width === 0 || a.height === 0) return 1;
  const luminanceA = toLuminance(a);
  const luminanceB = toLuminance(b);
  const blockSize = 8;
  const blocksX = Math.max(1, Math.floor(a.width / blockSize));
  const blocksY = Math.max(1, Math.floor(a.height / blockSize));
  let sum = 0;
  let count = 0;
  // Constants from Wang-2004 with L = 255 (8-bit dynamic range).
  const L = 255;
  const K1 = 0.01;
  const K2 = 0.03;
  const C1 = K1 * L * (K1 * L);
  const C2 = K2 * L * (K2 * L);
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const x0 = bx * blockSize;
      const y0 = by * blockSize;
      const w = Math.min(blockSize, a.width - x0);
      const h = Math.min(blockSize, a.height - y0);
      const stats = blockStats(luminanceA, luminanceB, x0, y0, w, h, a.width);
      const numerator = (2 * stats.meanA * stats.meanB + C1) * (2 * stats.cov + C2);
      const denominator =
        (stats.meanA * stats.meanA + stats.meanB * stats.meanB + C1) *
        (stats.varA + stats.varB + C2);
      sum += numerator / denominator;
      count++;
    }
  }
  return count === 0 ? 1 : sum / count;
}

function toLuminance(image: DecodedImage): Float64Array {
  const out = new Float64Array(image.width * image.height);
  let outIdx = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    // ITU-R BT.601 luma coefficients — same family the workspace
    // viewer uses for greyscale previews.
    const r = image.data[i] ?? 0;
    const g = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    out[outIdx++] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return out;
}

interface BlockStats {
  readonly meanA: number;
  readonly meanB: number;
  readonly varA: number;
  readonly varB: number;
  readonly cov: number;
}

function blockStats(
  a: Float64Array,
  b: Float64Array,
  x0: number,
  y0: number,
  w: number,
  h: number,
  stride: number,
): BlockStats {
  const n = w * h;
  let sumA = 0;
  let sumB = 0;
  for (let y = 0; y < h; y++) {
    const row = (y0 + y) * stride + x0;
    for (let x = 0; x < w; x++) {
      sumA += a[row + x] ?? 0;
      sumB += b[row + x] ?? 0;
    }
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let y = 0; y < h; y++) {
    const row = (y0 + y) * stride + x0;
    for (let x = 0; x < w; x++) {
      const da = (a[row + x] ?? 0) - meanA;
      const db = (b[row + x] ?? 0) - meanB;
      varA += da * da;
      varB += db * db;
      cov += da * db;
    }
  }
  return {
    meanA,
    meanB,
    varA: varA / n,
    varB: varB / n,
    cov: cov / n,
  };
}
