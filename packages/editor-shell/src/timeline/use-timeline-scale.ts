// packages/editor-shell/src/timeline/use-timeline-scale.ts
// Hook managing a `TimelineScale` with a zoom knob (T-181b).
//
// Callers supply the composition's `fps` and the base `pxPerSecond`; the
// hook returns the current scale, a scalar zoom (1.0 = base), and setters
// for both. Zoom is clamped to sensible bounds so the ruler never collapses
// to 0 or expands beyond the screen.

'use client';

import { useCallback, useMemo, useState } from 'react';

import type { TimelineScale } from './math';

export interface UseTimelineScaleOptions {
  /** Frames per second on the composition. */
  readonly fps: number;
  /** Pixels per second at zoom = 1. */
  readonly basePxPerSecond?: number;
  /** Initial zoom; defaults to 1. */
  readonly initialZoom?: number;
  /** Minimum zoom; defaults to 0.125 (8×-out). */
  readonly minZoom?: number;
  /** Maximum zoom; defaults to 8 (8×-in). */
  readonly maxZoom?: number;
}

export interface UseTimelineScaleResult {
  readonly scale: TimelineScale;
  readonly zoom: number;
  readonly setZoom: (next: number) => void;
  readonly zoomBy: (factor: number) => void;
  readonly reset: () => void;
}

const DEFAULT_BASE_PX_PER_SECOND = 100;
const DEFAULT_MIN_ZOOM = 0.125;
const DEFAULT_MAX_ZOOM = 8;

export function useTimelineScale(options: UseTimelineScaleOptions): UseTimelineScaleResult {
  const {
    fps,
    basePxPerSecond = DEFAULT_BASE_PX_PER_SECOND,
    initialZoom = 1,
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
  } = options;

  const clamp = useCallback(
    (z: number) => Math.min(maxZoom, Math.max(minZoom, z)),
    [minZoom, maxZoom],
  );

  const [zoom, setZoomRaw] = useState<number>(clamp(initialZoom));

  const setZoom = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      setZoomRaw(clamp(next));
    },
    [clamp],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      if (!Number.isFinite(factor) || factor <= 0) return;
      setZoomRaw((current) => clamp(current * factor));
    },
    [clamp],
  );

  const reset = useCallback(() => setZoomRaw(clamp(1)), [clamp]);

  const scale: TimelineScale = useMemo(
    () => ({ fps, pxPerSecond: basePxPerSecond * zoom }),
    [fps, basePxPerSecond, zoom],
  );

  return { scale, zoom, setZoom, zoomBy, reset };
}
