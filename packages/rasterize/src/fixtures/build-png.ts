// packages/rasterize/src/fixtures/build-png.ts
// Tiny PNG fixture builder for tests. Avoids checking binary fixtures into
// git — every test PNG is constructed in-memory from a programmatic RGBA
// buffer via `pngjs.PNG.sync.write`. Fixtures stay deterministic because
// pngjs's sync writer is deterministic at fixed options.

import { PNG } from 'pngjs';

/** Single RGBA pixel: [r, g, b, a] each 0–255. */
export type RgbaPixel = readonly [number, number, number, number];

/**
 * Build a PNG of `width × height`, where every pixel's color is computed by
 * `pixel(x, y)`. Returns the encoded PNG bytes. Used as a one-line fixture
 * builder in tests — keeps the test signal close to the assertion site.
 */
export function buildPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => RgbaPixel,
): Uint8Array {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = pixel(x, y);
      png.data[idx + 0] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  const buffer = PNG.sync.write(png);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * 4×4-tile checkerboard with alternating colors. Used for pixel-exact crop
 * tests — tile boundaries land at multiples of 4, so a bbox like
 * `{x:4, y:4, width:8, height:8}` lands exactly on tile boundaries.
 */
export function buildCheckerboard(
  size: number,
  tileSize: number,
  colorA: RgbaPixel,
  colorB: RgbaPixel,
): Uint8Array {
  return buildPng(size, size, (x, y) => {
    const tx = Math.floor(x / tileSize);
    const ty = Math.floor(y / tileSize);
    return (tx + ty) % 2 === 0 ? colorA : colorB;
  });
}

/** Read a single RGBA pixel at (x, y) from PNG bytes. Decodes via pngjs. */
export function readPixel(pngBytes: Uint8Array, x: number, y: number): RgbaPixel {
  const png = PNG.sync.read(Buffer.from(pngBytes));
  const idx = (y * png.width + x) * 4;
  const r = png.data[idx + 0];
  const g = png.data[idx + 1];
  const b = png.data[idx + 2];
  const a = png.data[idx + 3];
  if (r === undefined || g === undefined || b === undefined || a === undefined) {
    throw new Error(`pixel out of range: (${x}, ${y}) on ${png.width}×${png.height}`);
  }
  return [r, g, b, a];
}

/** Decoded PNG dimensions — convenience wrapper for tests. */
export function readDimensions(pngBytes: Uint8Array): { width: number; height: number } {
  const png = PNG.sync.read(Buffer.from(pngBytes));
  return { width: png.width, height: png.height };
}
