// packages/export-google-slides/src/diff/production-path.test.ts
// Pins the production diff pipeline end-to-end (B1 fix). The convergence
// loop, when no observations seam is supplied, must:
//   1. Fetch the API thumbnail.
//   2. Render the canonical golden at the API's actual dimensions (B2).
//   3. Run pixel-diff → connected-components → observations.
//   4. Drive `computeDiff` against the derived observations.
//   5. Fire `LF-GSLIDES-EXPORT-FALLBACK` for residuals at loop exit.
//
// This test does NOT use the test seam — it constructs PNGs that produce a
// known diff region overlapping the canonical element's bbox, and verifies
// the loop produces non-zero iterations + a residual.

import type { GoogleAuthProvider } from '@stageflip/import-google-slides';
import type { Document } from '@stageflip/schema';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { buildRecordingClient, makePngWithRect } from '../../test-helpers/index.js';
import { exportGoogleSlides } from '../exportGoogleSlides.js';
import { createStubRenderer } from '../renderer/stub.js';

/**
 * Build a PNG with multiple solid-color rects on a background. Used to
 * compose multi-region diff scenarios for production-path tests.
 */
function makePngMulti(opts: {
  width: number;
  height: number;
  bgColor: [number, number, number];
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    color: [number, number, number];
  }>;
}): Uint8Array {
  const png = new PNG({ width: opts.width, height: opts.height, colorType: 6 });
  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      const idx = (y * opts.width + x) * 4;
      png.data[idx] = opts.bgColor[0];
      png.data[idx + 1] = opts.bgColor[1];
      png.data[idx + 2] = opts.bgColor[2];
      png.data[idx + 3] = 255;
    }
  }
  for (const r of opts.rects) {
    const xEnd = Math.min(opts.width, r.x + r.width);
    const yEnd = Math.min(opts.height, r.y + r.height);
    for (let y = Math.max(0, r.y); y < yEnd; y++) {
      for (let x = Math.max(0, r.x); x < xEnd; x++) {
        const idx = (y * opts.width + x) * 4;
        png.data[idx] = r.color[0];
        png.data[idx + 1] = r.color[1];
        png.data[idx + 2] = r.color[2];
        png.data[idx + 3] = 255;
      }
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

const stubAuth: GoogleAuthProvider = {
  async getAccessToken() {
    return 'test-token';
  },
};

function makeOneSlideShapeDoc(width: number, height: number): Document {
  return {
    meta: {
      id: 'doc1',
      version: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    layouts: [],
    masters: [],
    content: {
      mode: 'slide',
      slides: [
        {
          id: 'slide_1',
          elements: [
            {
              id: 'shape1',
              type: 'shape',
              shape: 'rect',
              transform: { x: 100, y: 100, width: 200, height: 50, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
            },
          ],
        },
      ],
    },
  };
}

describe('production diff pipeline — B1 / B2', () => {
  it('B1: hybrid tier converges from real pixel diff (no observations seam)', async () => {
    // The element's canonical transform is (100,100,200,50). Golden draws
    // it there; API "renders" it shifted 30 px right + scaled. The diff
    // regions (left strip + right strip) drive `deriveObservations` to
    // produce a wider observed bbox, which exceeds the 1-px shape size
    // tolerance and forces a residual. We push the perceptualDiff above
    // 2% by adding a large secondary diff block elsewhere — without it,
    // the perceptualGate would short-circuit per AC #17.
    const goldenPng = makePngMulti({
      width: 1600,
      height: 900,
      bgColor: [255, 255, 255],
      rects: [{ x: 100, y: 100, width: 200, height: 50, color: [40, 40, 40] }],
    });
    // API has element shifted; plus a large unrelated noise block to push
    // perceptualDiff above the 2% gate (otherwise AC #17 short-circuits).
    const apiPng = makePngMulti({
      width: 1600,
      height: 900,
      bgColor: [255, 255, 255],
      rects: [
        { x: 130, y: 100, width: 200, height: 50, color: [40, 40, 40] },
        { x: 800, y: 400, width: 600, height: 400, color: [10, 10, 10] },
      ],
    });
    const apiClient = buildRecordingClient({
      thumbnailBytes: apiPng,
      thumbnailWidth: 1600,
      thumbnailHeight: 900,
    });
    const renderer = createStubRenderer({ pngsBySlideId: { slide_1: goldenPng } });
    const result = await exportGoogleSlides(makeOneSlideShapeDoc(1600, 900), {
      auth: stubAuth,
      presentationId: 'pres-b1',
      renderer,
      tier: 'hybrid',
      maxIterations: 2,
      apiClient,
    });
    // Loop must have run (non-zero iterations).
    expect(result.outcomes[0]?.iterations).toBeGreaterThan(0);
    // Residual triggered image-fallback (drive upload + LF-GSLIDES-EXPORT-FALLBACK).
    expect(apiClient.driveUploads.length).toBeGreaterThanOrEqual(1);
    const fallback = result.lossFlags.find((f) => f.code === 'LF-GSLIDES-EXPORT-FALLBACK');
    expect(fallback).toBeDefined();
  });

  it('B2: renderer is invoked at the actual thumbnail dimensions (4:3 deck → 1600×1200)', async () => {
    const goldenPng = makePngWithRect({
      width: 1600,
      height: 1200,
      bgColor: [255, 255, 255],
    });
    const apiPng = makePngWithRect({
      width: 1600,
      height: 1200,
      bgColor: [255, 255, 255],
    });
    const apiClient = buildRecordingClient({
      thumbnailBytes: apiPng,
      thumbnailWidth: 1600,
      thumbnailHeight: 1200,
    });
    const sizes: Array<{ width: number; height: number }> = [];
    const renderer = {
      async renderSlide(
        _doc: Document,
        _slideId: string,
        sizePx: { width: number; height: number },
      ) {
        sizes.push(sizePx);
        return goldenPng;
      },
    };
    await exportGoogleSlides(makeOneSlideShapeDoc(1600, 1200), {
      auth: stubAuth,
      presentationId: 'pres-43',
      renderer,
      tier: 'hybrid',
      maxIterations: 1,
      apiClient,
    });
    // Renderer was called at least once at the 4:3 dimensions, never at 16:9.
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) {
      expect(s).toEqual({ width: 1600, height: 1200 });
    }
  });

  it('B2: non-standard 3:1 thumbnails (1600×533) drive the renderer at the same dims', async () => {
    const goldenPng = makePngWithRect({
      width: 1600,
      height: 533,
      bgColor: [255, 255, 255],
    });
    const apiPng = makePngWithRect({
      width: 1600,
      height: 533,
      bgColor: [255, 255, 255],
    });
    const apiClient = buildRecordingClient({
      thumbnailBytes: apiPng,
      thumbnailWidth: 1600,
      thumbnailHeight: 533,
    });
    const sizes: Array<{ width: number; height: number }> = [];
    const renderer = {
      async renderSlide(
        _doc: Document,
        _slideId: string,
        sizePx: { width: number; height: number },
      ) {
        sizes.push(sizePx);
        return goldenPng;
      },
    };
    await exportGoogleSlides(makeOneSlideShapeDoc(1600, 533), {
      auth: stubAuth,
      presentationId: 'pres-31',
      renderer,
      tier: 'hybrid',
      maxIterations: 1,
      apiClient,
    });
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) {
      expect(s).toEqual({ width: 1600, height: 533 });
    }
  });

  it('B2: pixel-perfect-visual learns dimensions from the thumbnail and renders golden at same size', async () => {
    const goldenPng = makePngWithRect({
      width: 1600,
      height: 1200,
      bgColor: [255, 255, 255],
    });
    const apiPng = makePngWithRect({
      width: 1600,
      height: 1200,
      bgColor: [255, 255, 255],
    });
    const apiClient = buildRecordingClient({
      thumbnailBytes: apiPng,
      thumbnailWidth: 1600,
      thumbnailHeight: 1200,
    });
    const sizes: Array<{ width: number; height: number }> = [];
    const renderer = {
      async renderSlide(
        _doc: Document,
        _slideId: string,
        sizePx: { width: number; height: number },
      ) {
        sizes.push(sizePx);
        return goldenPng;
      },
    };
    await exportGoogleSlides(makeOneSlideShapeDoc(1600, 1200), {
      auth: stubAuth,
      presentationId: 'pres-pp43',
      renderer,
      tier: 'pixel-perfect-visual',
      apiClient,
    });
    // Renderer is called once for the golden; at 4:3 dims.
    expect(sizes.length).toBe(1);
    expect(sizes[0]).toEqual({ width: 1600, height: 1200 });
  });
});
