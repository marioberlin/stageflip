// packages/parity/src/image-data.ts
// RGBA image-data container + PNG decode + crop — the universal
// currency of the parity harness.
//
// Comparators (PSNR, SSIM) consume `ParityImageData` directly. The shape
// matches the `ssim.js` `ImageData` type exactly (readonly `data`,
// `width`, `height`) so it can be passed through without a shim. PNG
// decode goes through `pngjs` — pure-JS, MIT, zero runtime transitive
// deps. Sharp was considered first but its `libvips` binding is
// LGPL-3.0-or-later; CLAUDE.md §3 and `THIRD_PARTY.md` §1.1 gate LGPL
// behind a per-package ADR, and pngjs avoids the policy exposure
// entirely without any practical cost at fixture sizes.

import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

/**
 * Shape-compatible with `ssim.js`'s `ImageData` and the browser
 * `ImageData` interface: row-major RGBA, 8 bits per channel, length
 * `width * height * 4`. Kept here (not re-exported from `ssim.js`) so
 * callers don't incur the ssim.js type surface when they only need the
 * container.
 */
export interface ParityImageData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/** A rectangular region inside a `ParityImageData`, integer-aligned. */
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Decode a PNG file (by path) or raw PNG byte buffer into an
 * RGBA `ParityImageData`. pngjs always emits an alpha channel in the
 * decoded output so the byte layout (RGBA, 8 bits per channel) is
 * uniform regardless of whether the source PNG had an alpha channel.
 */
export async function loadPng(source: string | Uint8Array): Promise<ParityImageData> {
  const bytes = typeof source === 'string' ? await readFile(source) : Buffer.from(source);
  return new Promise<ParityImageData>((resolve, reject) => {
    const png = new PNG();
    png.parse(bytes, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }
      // `decoded.data` is a Buffer; wrap in a Uint8ClampedArray view over
      // the same underlying memory so ssim.js + PSNR receive the exact
      // shape they expect without a copy.
      resolve({
        width: decoded.width,
        height: decoded.height,
        data: new Uint8ClampedArray(
          decoded.data.buffer,
          decoded.data.byteOffset,
          decoded.data.byteLength,
        ),
      });
    });
  });
}

/** Throw with a diagnostic message if `a` and `b` have different dimensions. */
export function assertSameDimensions(a: ParityImageData, b: ParityImageData): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `parity: dimension mismatch — got ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    );
  }
}

/**
 * Copy-crop `image` to `region`. Throws if the region escapes the image
 * bounds or has a non-positive size. Pure: allocates a new buffer.
 */
export function crop(image: ParityImageData, region: Region): ParityImageData {
  if (region.width <= 0 || region.height <= 0) {
    throw new Error(
      `parity: crop region must have positive width/height — got ${region.width}x${region.height}`,
    );
  }
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > image.width ||
    region.y + region.height > image.height
  ) {
    throw new Error(
      `parity: crop region [${region.x}, ${region.y}, ${region.width}x${region.height}] escapes image bounds ${image.width}x${image.height}`,
    );
  }
  const out = new Uint8ClampedArray(region.width * region.height * 4);
  const srcStride = image.width * 4;
  const dstStride = region.width * 4;
  for (let row = 0; row < region.height; row++) {
    const srcOff = (region.y + row) * srcStride + region.x * 4;
    const dstOff = row * dstStride;
    out.set(image.data.subarray(srcOff, srcOff + dstStride), dstOff);
  }
  return { width: region.width, height: region.height, data: out };
}
