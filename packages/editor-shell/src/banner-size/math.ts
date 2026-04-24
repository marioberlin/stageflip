// packages/editor-shell/src/banner-size/math.ts
// Pure layout math for the multi-size banner preview grid (T-201).
//
// Unlike `AspectRatioGrid` (T-182), the entries here are fixed pixel
// dimensions (300×250, 728×90, 160×600 — the canonical IAB set from
// T-200). The grid computes one shared scale factor so the row of
// cells fits the container while preserving every banner's
// proportions relative to its siblings.

import type { BoxSize } from '../aspect-ratio/math';

/** One banner dimension shown in the grid. */
export interface BannerSize {
  readonly width: number;
  readonly height: number;
  /** Optional stable id; defaults to `${width}x${height}` at the component layer. */
  readonly id?: string;
  /** Optional human label (e.g. "Medium Rectangle"). */
  readonly name?: string;
}

export interface BannerSizePlacement {
  readonly size: BannerSize;
  /** Rendered width in px after applying the uniform scale. */
  readonly widthPx: number;
  /** Rendered height in px after applying the uniform scale. */
  readonly heightPx: number;
  /** Uniform scale factor applied across every cell in the grid. */
  readonly scale: number;
}

export interface BannerSizeLayoutOptions {
  /** Horizontal gap between cells in px. Defaults to 16. */
  readonly gapPx?: number;
  /** Upper bound on scale — a container larger than the banners won't enlarge them beyond this. Defaults to 1. */
  readonly maxScale?: number;
  /** Lower bound on scale. Container-too-small cases clamp here rather than producing pixel soup. Defaults to 0.1. */
  readonly minScale?: number;
}

/**
 * Lay out a row of fixed-dimension banner sizes inside a container.
 *
 * Every cell shares a single uniform scale factor. Scale is the largest
 * value in `[minScale, maxScale]` where:
 *   - the sum of scaled widths + gaps fits `container.width`, AND
 *   - the largest scaled height fits `container.height`.
 *
 * Zero / empty input returns an empty array. A zero-width or
 * zero-height container returns placements sized to `0×0` so consumers
 * can still render scaffolding.
 */
export function layoutBannerSizes(
  sizes: readonly BannerSize[],
  container: BoxSize,
  options: BannerSizeLayoutOptions = {},
): BannerSizePlacement[] {
  if (sizes.length === 0) return [];
  const gapPx = options.gapPx ?? 16;
  const maxScale = options.maxScale ?? 1;
  const minScale = Math.min(options.minScale ?? 0.1, maxScale);

  if (container.width <= 0 || container.height <= 0) {
    return sizes.map((s) => ({ size: s, widthPx: 0, heightPx: 0, scale: 0 }));
  }

  const totalGaps = gapPx * Math.max(0, sizes.length - 1);
  const sumWidths = sizes.reduce((acc, s) => acc + Math.max(0, s.width), 0);
  const maxHeight = sizes.reduce((acc, s) => Math.max(acc, s.height), 0);

  if (sumWidths <= 0 || maxHeight <= 0) {
    return sizes.map((s) => ({ size: s, widthPx: 0, heightPx: 0, scale: 0 }));
  }

  const usableWidth = Math.max(0, container.width - totalGaps);
  const widthScale = usableWidth / sumWidths;
  const heightScale = container.height / maxHeight;
  const rawScale = Math.min(widthScale, heightScale);
  const scale = Math.max(minScale, Math.min(maxScale, rawScale));

  return sizes.map((s) => ({
    size: s,
    widthPx: s.width * scale,
    heightPx: s.height * scale,
    scale,
  }));
}
