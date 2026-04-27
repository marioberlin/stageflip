// packages/export-google-slides/src/diff/connected-components.ts
// 4-connectivity connected-components labeling on the binary diff mask.
// Each labeled region collapses to its bounding box + pixel count. Used by
// the convergence loop to convert pixel-level drift into per-element
// observed bboxes (T-252 spec §3 — "extract bbox from the rendered Slides
// PNG via simple connected-components on the rendered text region").
//
// Implementation: iterative flood fill with an explicit queue (no recursion;
// avoids stack overflow on large diff regions). Deterministic: scans
// row-major; labels assigned in scan order.

export interface DiffRegion {
  /** Label assigned by the scan (1-indexed). */
  label: number;
  /** Inclusive minimum x coordinate. */
  x: number;
  /** Inclusive minimum y coordinate. */
  y: number;
  /** Bounding-box width (`xMax - x + 1`). */
  width: number;
  /** Bounding-box height (`yMax - y + 1`). */
  height: number;
  /** Number of pixels in the connected component. */
  pixelCount: number;
}

export interface FindRegionsOptions {
  /** Drop regions whose `pixelCount` is below this threshold. Default 1. */
  minPixelCount?: number;
}

/**
 * Label connected components in a binary mask and return their bounding
 * boxes + pixel counts.
 *
 * Inputs:
 *   - `mask`: row-major Uint8Array of length `width * height`. Non-zero
 *     entries are foreground (diff pixels); zero is background.
 *
 * 4-connectivity (N/E/S/W). If two diff pixels are diagonal-only neighbors
 * they form separate components — matches the conservative scoring metric
 * the spec implies (a tighter components definition produces smaller
 * regions, which yields fewer false-positive observations against the
 * canonical bboxes).
 */
export function findRegions(
  mask: Uint8Array,
  width: number,
  height: number,
  options: FindRegionsOptions = {},
): DiffRegion[] {
  const minPixelCount = options.minPixelCount ?? 1;
  const labels = new Int32Array(mask.length);
  const regions: DiffRegion[] = [];
  let nextLabel = 0;
  // Reusable BFS queue. Fixed-size buffer indexed by head/tail pointers
  // avoids per-region allocation cost on large slides.
  const queue = new Int32Array(mask.length);
  for (let y0 = 0; y0 < height; y0++) {
    for (let x0 = 0; x0 < width; x0++) {
      const idx0 = y0 * width + x0;
      if (mask[idx0] === 0 || labels[idx0] !== 0) continue;
      nextLabel += 1;
      let xMin = x0;
      let xMax = x0;
      let yMin = y0;
      let yMax = y0;
      let pixelCount = 0;
      let head = 0;
      let tail = 0;
      queue[tail++] = idx0;
      labels[idx0] = nextLabel;
      while (head < tail) {
        const cur = queue[head++] ?? 0;
        const cy = Math.floor(cur / width);
        const cx = cur - cy * width;
        pixelCount += 1;
        if (cx < xMin) xMin = cx;
        if (cx > xMax) xMax = cx;
        if (cy < yMin) yMin = cy;
        if (cy > yMax) yMax = cy;
        // 4-connectivity neighbors.
        const neighbors = [
          cx > 0 ? cur - 1 : -1, // W
          cx + 1 < width ? cur + 1 : -1, // E
          cy > 0 ? cur - width : -1, // N
          cy + 1 < height ? cur + width : -1, // S
        ];
        for (const ni of neighbors) {
          if (ni < 0) continue;
          if (mask[ni] === 0 || labels[ni] !== 0) continue;
          labels[ni] = nextLabel;
          queue[tail++] = ni;
        }
      }
      if (pixelCount >= minPixelCount) {
        regions.push({
          label: nextLabel,
          x: xMin,
          y: yMin,
          width: xMax - xMin + 1,
          height: yMax - yMin + 1,
          pixelCount,
        });
      }
    }
  }
  return regions;
}
