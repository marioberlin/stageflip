// packages/rasterize/src/rasterize.test.ts
// Top-level integration tests for `rasterizeFromThumbnail`. Every T-245 AC
// is pinned here or in the unit-test files (decode.test.ts, crop.test.ts,
// encode.test.ts). AC numbering in test descriptions matches docs/tasks/T-245.md.

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCheckerboard, buildPng, readDimensions, readPixel } from './fixtures/build-png.js';
import {
  DEFAULT_COMPRESSION_LEVEL,
  DEFAULT_FILTER_TYPE,
  DEFAULT_PADDING_PX,
  RasterizeError,
  rasterizeFromThumbnail,
} from './index.js';

const RED = [255, 0, 0, 255] as const;
const BLUE = [0, 0, 255, 255] as const;
const GREEN = [0, 255, 0, 255] as const;

// ---------------------------------------------------------------------------
// AC #1 — public surface returns a Promise<RasterizedAsset> with 4+1 fields.
// ---------------------------------------------------------------------------

describe('rasterizeFromThumbnail — public surface (AC #1)', () => {
  it('returns a Promise resolving to a RasterizedAsset with the documented fields', async () => {
    const source = buildPng(16, 16, () => [...RED]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 4, y: 4, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    expect(result).toMatchObject({
      contentType: 'image/png',
    });
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(typeof result.contentHashId).toBe('string');
    expect(typeof result.width).toBe('number');
    expect(typeof result.height).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// AC #2 — default paddingPx is 16; confirm via output size on a known bbox.
// ---------------------------------------------------------------------------

describe('default options pinning (AC #2 / #3 / #4)', () => {
  it('AC #2 — defaults paddingPx to 16: 100×100 source + bbox (40,40,20,20) → 52×52 output', async () => {
    expect(DEFAULT_PADDING_PX).toBe(16);
    const source = buildPng(100, 100, () => [...BLUE]);
    const result = await rasterizeFromThumbnail(source, {
      x: 40,
      y: 40,
      width: 20,
      height: 20,
    });
    // padded: x=24, y=24, w=20+32=52, h=20+32=52
    expect(result.width).toBe(52);
    expect(result.height).toBe(52);
    expect(readDimensions(result.bytes)).toEqual({ width: 52, height: 52 });
  });

  it('AC #3 — defaults compressionLevel to 6: explicit override produces different bytes', async () => {
    expect(DEFAULT_COMPRESSION_LEVEL).toBe(6);
    const source = buildPng(32, 32, (x, y) => [
      (x * 8) % 256,
      (y * 8) % 256,
      ((x + y) * 4) % 256,
      255,
    ]);
    const a = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 32, height: 32 },
      { paddingPx: 0 },
    );
    const b = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 32, height: 32 },
      { paddingPx: 0, compressionLevel: 0 },
    );
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(false);
  });

  it('AC #4 — defaults filterType to pngjs 7 "all filters" sentinel (-1)', async () => {
    // T-245 spec §3 names this `pngjs.constants.PNG_ALL_FILTERS`. pngjs 7
    // doesn't publish that constant; the equivalent sentinel for adaptive
    // per-row filter selection is -1.
    expect(DEFAULT_FILTER_TYPE).toBe(-1);
    const source = buildPng(8, 8, () => [...GREEN]);
    const a = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    const b = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 8, height: 8 },
      { paddingPx: 0, filterType: DEFAULT_FILTER_TYPE },
    );
    // Explicit-default override should produce byte-identical output.
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Crop algorithm — AC #5–#9.
// ---------------------------------------------------------------------------

describe('crop algorithm', () => {
  it('AC #5 — pixel-exact crop on a 4×4-tile checkerboard 16×16, bbox (4,4,8,8), padding 0', async () => {
    const source = buildCheckerboard(16, 4, [...RED], [...BLUE]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 4, y: 4, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    // buildCheckerboard maps tile (tx,ty) where (tx+ty) % 2 === 0 → colorA (RED).
    // Source tile at (1,1) (i.e. source pixel range x=4..7, y=4..7): tx+ty=2 → RED.
    // Source tile at (2,1) (x=8..11, y=4..7): tx+ty=3 → BLUE.
    // Cropped origin (0,0) corresponds to source (4,4) → RED.
    expect(readPixel(result.bytes, 0, 0)).toEqual([...RED]);
    expect(readPixel(result.bytes, 3, 3)).toEqual([...RED]);
    expect(readPixel(result.bytes, 4, 0)).toEqual([...BLUE]);
    expect(readPixel(result.bytes, 7, 3)).toEqual([...BLUE]);
    // Tile at (1,2) is BLUE; at (2,2) is RED.
    expect(readPixel(result.bytes, 0, 4)).toEqual([...BLUE]);
    expect(readPixel(result.bytes, 4, 4)).toEqual([...RED]);
  });

  it('AC #6 — paddingPx: 4 grows the crop by 4 px on each side, matching source pixels', async () => {
    const source = buildCheckerboard(16, 4, [...RED], [...BLUE]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 4, y: 4, width: 8, height: 8 },
      { paddingPx: 4 },
    );
    // padded: x=0, y=0, w=16, h=16 → entire source.
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
    // Pixel at (0,0) of cropped output = source (0,0) = RED tile.
    expect(readPixel(result.bytes, 0, 0)).toEqual([...RED]);
    // Pixel at (15,15) of cropped output = source (15,15) = RED tile.
    expect(readPixel(result.bytes, 15, 15)).toEqual([...RED]);
  });

  it('AC #7 — clamps top-left bbox; visible region only, no zero-padding', async () => {
    // 100×100 source. bbox starts at (-10,-10), size 20×20. Visible region is
    // 0..10 × 0..10. The output PNG is 10×10 (NOT 20×20 with transparent border).
    const source = buildPng(100, 100, () => [...GREEN]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: -10, y: -10, width: 20, height: 20 },
      { paddingPx: 0 },
    );
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(readPixel(result.bytes, 0, 0)).toEqual([...GREEN]);
    expect(readPixel(result.bytes, 9, 9)).toEqual([...GREEN]);
  });

  it('AC #8 — clamps bottom-right bbox; visible region only', async () => {
    const source = buildPng(100, 100, () => [...BLUE]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 90, y: 90, width: 50, height: 50 },
      { paddingPx: 0 },
    );
    // visible region: 90..100, size 10×10
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('AC #9 — bbox exactly at source extent + padding 0 → output dimensions match the source', async () => {
    const source = buildPng(8, 8, (x, y) => [(x * 32) % 256, (y * 32) % 256, 0, 255]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    // Pixels round-trip identically.
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(readPixel(result.bytes, x, y)).toEqual([(x * 32) % 256, (y * 32) % 256, 0, 255]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Validation — AC #10–#16.
// ---------------------------------------------------------------------------

describe('validation', () => {
  it('AC #10 — invalid PNG signature throws RasterizeError(INVALID_PNG)', async () => {
    const bogus = new Uint8Array(64);
    bogus[0] = 0xff;
    bogus[1] = 0xd8; // JPEG magic
    await expect(
      rasterizeFromThumbnail(bogus, { x: 0, y: 0, width: 1, height: 1 }),
    ).rejects.toMatchObject({ code: 'INVALID_PNG' });
  });

  it('AC #11 — empty pageImage throws INVALID_PNG', async () => {
    await expect(
      rasterizeFromThumbnail(new Uint8Array(0), { x: 0, y: 0, width: 1, height: 1 }),
    ).rejects.toMatchObject({ code: 'INVALID_PNG' });
  });

  it('AC #12 — fully-out-of-bounds bbox throws BBOX_OUT_OF_BOUNDS', async () => {
    const source = buildPng(100, 100, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: 1000, y: 1000, width: 1, height: 1 }, { paddingPx: 0 }),
    ).rejects.toMatchObject({ code: 'BBOX_OUT_OF_BOUNDS' });
  });

  it('AC #13 — negative bbox dimensions throw BBOX_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: -1, height: 4 }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: -1 }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
  });

  it('AC #13 — zero bbox dimensions throw BBOX_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 0, height: 4 }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
  });

  it('AC #14 — NaN in any bbox field throws BBOX_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: Number.NaN, y: 0, width: 4, height: 4 }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: Number.NaN, width: 4, height: 4 }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: Number.NaN, height: 4 }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: Number.NaN }),
    ).rejects.toMatchObject({ code: 'BBOX_INVALID' });
  });

  it('AC #15 — negative paddingPx throws OPTIONS_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: 4 }, { paddingPx: -1 }),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
  });

  it('AC #15 — NaN paddingPx throws OPTIONS_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(
        source,
        { x: 0, y: 0, width: 4, height: 4 },
        { paddingPx: Number.NaN },
      ),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
  });

  it('AC #16 — filterType out of -1..4 throws OPTIONS_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: 4 }, { filterType: 100 }),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: 4 }, { filterType: -2 }),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: 4 }, { filterType: 1.5 }),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
    await expect(
      rasterizeFromThumbnail(
        source,
        { x: 0, y: 0, width: 4, height: 4 },
        { filterType: Number.NaN },
      ),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
  });

  it('AC #16 — compressionLevel out of 0..9 throws OPTIONS_INVALID', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: 4 }, { compressionLevel: -1 }),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
    await expect(
      rasterizeFromThumbnail(source, { x: 0, y: 0, width: 4, height: 4 }, { compressionLevel: 10 }),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
    await expect(
      rasterizeFromThumbnail(
        source,
        { x: 0, y: 0, width: 4, height: 4 },
        { compressionLevel: 5.5 },
      ),
    ).rejects.toMatchObject({ code: 'OPTIONS_INVALID' });
  });
});

// ---------------------------------------------------------------------------
// Determinism — AC #17, #18, #19.
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('AC #17 — same pageImage + bboxPx + default opts → byte-identical bytes + contentHashId', async () => {
    const source = buildPng(32, 32, (x, y) => [
      (x * 8) % 256,
      (y * 8) % 256,
      ((x ^ y) * 16) % 256,
      255,
    ]);
    const a = await rasterizeFromThumbnail(source, { x: 4, y: 4, width: 16, height: 16 });
    const b = await rasterizeFromThumbnail(source, { x: 4, y: 4, width: 16, height: 16 });
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
    expect(a.contentHashId).toBe(b.contentHashId);
  });

  it('AC #18 — different compressionLevel produces different bytes (option flows through)', async () => {
    const source = buildPng(32, 32, (x, y) => [(x * 4) % 256, (y * 4) % 256, 64, 255]);
    const a = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 16, height: 16 },
      { paddingPx: 0, compressionLevel: 0 },
    );
    const b = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 16, height: 16 },
      { paddingPx: 0, compressionLevel: 9 },
    );
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(false);
  });

  // AC #19 — source-level grep test mirroring T-253-base AC #28 / T-247 AC #33.
  // Walks src/**/*.ts (excluding *.test.ts and fixtures/) and asserts that no
  // source line uses the forbidden non-deterministic APIs. Determinism's
  // restricted scope (CLAUDE.md §3) doesn't formally include this package,
  // but T-245 spec §3 declares the discipline applies.
  it('AC #19 — package source contains no forbidden non-deterministic APIs', async () => {
    const SRC_ROOT = join(__dirname);
    const paths = await collectSourceFiles(SRC_ROOT);
    const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; api: string }> = [
      { pattern: /\bDate\.now\s*\(/, api: 'Date.now()' },
      { pattern: /\bnew\s+Date\s*\(\s*\)/, api: 'new Date()' },
      { pattern: /\bMath\.random\s*\(/, api: 'Math.random()' },
      { pattern: /\bperformance\.now\s*\(/, api: 'performance.now()' },
      { pattern: /\bsetTimeout\s*\(/, api: 'setTimeout(' },
      { pattern: /\bsetInterval\s*\(/, api: 'setInterval(' },
    ];
    const violations: string[] = [];
    for (const path of paths) {
      const content = await readFile(path, 'utf8');
      for (const { pattern, api } of FORBIDDEN) {
        if (pattern.test(content)) {
          violations.push(`${path}: ${api}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

async function collectSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the fixtures directory: it builds in-memory PNGs for tests, so
      // its source isn't subject to the production discipline. The grep
      // would also stumble over `Math.floor` (allowed; the regex is precise
      // enough but skipping keeps the rule scope clear).
      if (entry.name === 'fixtures') continue;
      out.push(...(await collectSourceFiles(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content hash — AC #20, #21, #22.
// ---------------------------------------------------------------------------

describe('content hash', () => {
  it('AC #20 — contentHashId is exactly 64 hex chars (full sha256, NOT truncated)', async () => {
    const source = buildPng(8, 8, () => [...RED]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    expect(result.contentHashId).toHaveLength(64);
    expect(result.contentHashId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('AC #21 — different bytes → different contentHashId', async () => {
    // Use a non-symmetric source so distinct crops genuinely have different
    // pixel data. A simple gradient on R varies along x; cropping different
    // x-ranges produces different byte streams.
    const source = buildPng(32, 32, (x, _y) => [(x * 8) % 256, 0, 0, 255]);
    const a = await rasterizeFromThumbnail(
      source,
      { x: 0, y: 0, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    const b = await rasterizeFromThumbnail(
      source,
      { x: 16, y: 0, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(false);
    expect(a.contentHashId).not.toBe(b.contentHashId);
  });

  it('AC #22 — contentHashId matches createHash("sha256").update(bytes).digest("hex")', async () => {
    const source = buildPng(16, 16, (x, y) => [x * 16, y * 16, 0, 255]);
    const result = await rasterizeFromThumbnail(
      source,
      { x: 2, y: 2, width: 8, height: 8 },
      { paddingPx: 0 },
    );
    const expected = createHash('sha256').update(result.bytes).digest('hex');
    expect(result.contentHashId).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Errors — AC #23, #24.
// ---------------------------------------------------------------------------

describe('errors', () => {
  it('AC #23 — RasterizeError is an Error subclass with .code and optional .cause', async () => {
    let thrown: unknown = null;
    try {
      await rasterizeFromThumbnail(new Uint8Array(0), { x: 0, y: 0, width: 1, height: 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toBeInstanceOf(RasterizeError);
    expect((thrown as RasterizeError).code).toBe('INVALID_PNG');
  });

  it('AC #23 — RasterizeError carries .cause when provided', async () => {
    // Drive the cause path via a corrupt PNG body that pngjs rejects.
    const corrupt = new Uint8Array(64);
    corrupt.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let thrown: unknown = null;
    try {
      await rasterizeFromThumbnail(corrupt, { x: 0, y: 0, width: 1, height: 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(RasterizeError);
    expect((thrown as RasterizeError).cause).toBeDefined();
  });

  it('AC #24 — error message includes the code + a human-readable description', async () => {
    let thrown: unknown = null;
    try {
      await rasterizeFromThumbnail(new Uint8Array(0), { x: 0, y: 0, width: 1, height: 1 });
    } catch (err) {
      thrown = err;
    }
    const msg = (thrown as Error).message;
    expect(msg).toContain('INVALID_PNG');
    expect(msg.length).toBeGreaterThan('INVALID_PNG'.length + 4);
  });
});
