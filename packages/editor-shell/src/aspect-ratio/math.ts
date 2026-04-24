// packages/editor-shell/src/aspect-ratio/math.ts
// Pure math for the multi-aspect preview bouncer (T-182).
//
// The bouncer shows the same composition rendered against several output
// aspect ratios at once so the operator can see how cropping/letterboxing
// play out before committing. This module owns:
//   - The `AspectRatio` shape.
//   - The canonical set of common ratios (16:9, 1:1, 9:16).
//   - `fitAspect` — fit an aspect-ratio into a bounding box, preserving
//     the ratio (largest rectangle that fits).
//   - `layoutAspectPreviews` — lay out N aspect-ratio boxes in a single
//     row with a gap; each box is the largest that fits the shared row
//     height and the container width.

/** An aspect ratio expressed as `w:h` with an optional human label. */
export interface AspectRatio {
  readonly w: number;
  readonly h: number;
  readonly label?: string;
}

/** The three canonical video output aspects StageFlip.Video ships. */
export const COMMON_ASPECTS: readonly AspectRatio[] = [
  { w: 16, h: 9, label: '16:9' },
  { w: 1, h: 1, label: '1:1' },
  { w: 9, h: 16, label: '9:16' },
];

export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Fit an aspect ratio inside a bounding box, preserving the ratio.
 * Returns the largest rectangle that fits the bounds. Zero-width or
 * zero-height bounds collapse to `{ 0, 0 }`.
 */
export function fitAspect(aspect: AspectRatio, bounds: BoxSize): BoxSize {
  if (bounds.width <= 0 || bounds.height <= 0) return { width: 0, height: 0 };
  if (aspect.w <= 0 || aspect.h <= 0) return { width: 0, height: 0 };
  const ratio = aspect.w / aspect.h;
  const boundsRatio = bounds.width / bounds.height;
  if (boundsRatio > ratio) {
    // bounds is wider than the aspect — height-constrained
    return { width: bounds.height * ratio, height: bounds.height };
  }
  // bounds is taller (or equal) — width-constrained
  return { width: bounds.width, height: bounds.width / ratio };
}

export interface AspectRowLayoutOptions {
  /** Horizontal gap between previews in pixels. Defaults to 12. */
  readonly gapPx?: number;
  /**
   * Optional cap on preview height so a very tall container doesn't
   * blow up the previews. Defaults to `container.height`.
   */
  readonly maxHeightPx?: number;
}

export interface AspectPreviewPlacement {
  readonly aspect: AspectRatio;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Lay out N aspect-ratio previews in a single row inside a container.
 *
 * All previews share a common height (the largest height where the sum
 * of widths + gaps fits the container width, subject to
 * `maxHeightPx`). Per-preview width is then derived from that common
 * height.
 *
 * Empty input returns an empty array. A container with zero width or
 * height returns placements sized to `0×0` so consumers can still
 * render scaffolding without crashing.
 */
export function layoutAspectPreviews(
  aspects: readonly AspectRatio[],
  container: BoxSize,
  options: AspectRowLayoutOptions = {},
): AspectPreviewPlacement[] {
  if (aspects.length === 0) return [];
  const gapPx = options.gapPx ?? 12;
  const totalGaps = gapPx * Math.max(0, aspects.length - 1);
  const usableWidth = Math.max(0, container.width - totalGaps);

  if (usableWidth <= 0 || container.height <= 0) {
    return aspects.map((a) => ({ aspect: a, widthPx: 0, heightPx: 0 }));
  }

  // Sum of ratios: if every preview shares `H` as its height, its width
  // is `H * (w/h)`. The sum across previews is `H * Σ(w/h)`. Solve for
  // the largest `H` where `H * Σ(w/h) <= usableWidth` and `H <= maxH`.
  const ratioSum = aspects.reduce((acc, a) => acc + (a.w > 0 && a.h > 0 ? a.w / a.h : 0), 0);
  if (ratioSum <= 0) {
    return aspects.map((a) => ({ aspect: a, widthPx: 0, heightPx: 0 }));
  }

  const maxHeightPx = options.maxHeightPx ?? container.height;
  const widthConstrainedHeight = usableWidth / ratioSum;
  const heightPx = Math.min(widthConstrainedHeight, maxHeightPx, container.height);

  return aspects.map((a) => {
    const ratio = a.w > 0 && a.h > 0 ? a.w / a.h : 0;
    return { aspect: a, widthPx: heightPx * ratio, heightPx };
  });
}
