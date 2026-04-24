// packages/editor-shell/src/timeline/tracks.ts
// Pure layout math for the horizontal multi-track video timeline (T-181).
// Computes vertical row geometry for the four video track kinds, maps
// per-element timing onto pixel blocks, and clamps ranges to the
// composition duration. Zero React.
//
// The video timeline stacks tracks top-to-bottom in this canonical order:
//
//   ┌───────────────────────────────────────────────┐  row 0: visual
//   ├───────────────────────────────────────────────┤  row 1: overlay
//   ├───────────────────────────────────────────────┤  row 2: caption
//   ├───────────────────────────────────────────────┤  row 3: audio
//   └───────────────────────────────────────────────┘
//
// Multiple tracks of the same kind stack within their kind's band. This
// file owns that geometry. `trackRowLayout` is the single entry point
// consumers call to turn an array of `TrackLaneInput`s into
// `TrackRowPlacement[]`.

import { type TimelineScale, frameToPx } from './math.js';

/** The four video track kinds. Mirrors `@stageflip/schema`'s `TrackKind`. */
export type TimelineTrackKind = 'visual' | 'overlay' | 'caption' | 'audio';

/**
 * Canonical top-to-bottom stacking order. Visual sits above everything
 * else so it dominates the viewport; audio lives at the bottom.
 */
export const TRACK_KIND_ORDER: readonly TimelineTrackKind[] = [
  'visual',
  'overlay',
  'caption',
  'audio',
] as const;

/** Minimum logical height a track row must render at, before per-kind adjustments. */
export const DEFAULT_TRACK_ROW_HEIGHT_PX = 56;

/** Per-kind height multipliers so audio + caption rows are naturally denser than visual. */
export const TRACK_KIND_HEIGHT_PX: Readonly<Record<TimelineTrackKind, number>> = {
  visual: 72,
  overlay: 56,
  caption: 40,
  audio: 56,
};

/** Input to `trackRowLayout`. One entry per registered track. */
export interface TrackLaneInput {
  readonly id: string;
  readonly kind: TimelineTrackKind;
}

/**
 * Output row placement: where a given track renders on the y-axis and
 * how tall it is. `index` is the row's 0-based position in the stacked
 * layout; `groupIndex` is its position *within* its kind's band
 * (useful when two visual tracks stack, for instance).
 */
export interface TrackRowPlacement {
  readonly id: string;
  readonly kind: TimelineTrackKind;
  readonly index: number;
  readonly groupIndex: number;
  readonly topPx: number;
  readonly heightPx: number;
}

/**
 * Compute the canonical top-to-bottom layout for a list of tracks.
 *
 * - Tracks are stable-sorted by {@link TRACK_KIND_ORDER}. Ordering within
 *   the same kind is preserved from the input.
 * - Per-row height follows {@link TRACK_KIND_HEIGHT_PX}.
 * - `topPx` accumulates row heights so consumers can absolutely-position
 *   each row without measuring the DOM.
 */
export function trackRowLayout(tracks: readonly TrackLaneInput[]): TrackRowPlacement[] {
  const grouped = new Map<TimelineTrackKind, TrackLaneInput[]>();
  for (const kind of TRACK_KIND_ORDER) grouped.set(kind, []);
  for (const t of tracks) {
    const bucket = grouped.get(t.kind);
    if (bucket) bucket.push(t);
  }

  const out: TrackRowPlacement[] = [];
  let topPx = 0;
  let index = 0;
  for (const kind of TRACK_KIND_ORDER) {
    const bucket = grouped.get(kind) ?? [];
    bucket.forEach((t, groupIndex) => {
      const heightPx = TRACK_KIND_HEIGHT_PX[kind];
      out.push({ id: t.id, kind, index, groupIndex, topPx, heightPx });
      topPx += heightPx;
      index += 1;
    });
  }
  return out;
}

/** Total vertical extent of the laid-out track rows in px. */
export function totalTrackStackHeight(placements: readonly TrackRowPlacement[]): number {
  if (placements.length === 0) return 0;
  const last = placements[placements.length - 1];
  if (!last) return 0;
  return last.topPx + last.heightPx;
}

/** An element's timing pinned to a track. Frames relative to composition start. */
export interface ElementBlockInput {
  readonly elementId: string;
  readonly startFrame: number;
  readonly endFrame: number;
}

/**
 * Clip an element block to the composition's `[0, durationFrames)` range
 * and convert to pixel geometry. Returns `null` when the block falls
 * entirely outside the composition (drop the element from rendering).
 */
export interface ElementBlockPlacement {
  readonly elementId: string;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly leftPx: number;
  readonly widthPx: number;
}

export function placeElementBlock(
  block: ElementBlockInput,
  durationFrames: number,
  scale: TimelineScale,
): ElementBlockPlacement | null {
  const start = Math.max(0, block.startFrame);
  const end = Math.min(durationFrames, block.endFrame);
  if (end <= start) return null;
  const leftPx = frameToPx(start, scale);
  const widthPx = Math.max(1, frameToPx(end, scale) - leftPx);
  return { elementId: block.elementId, startFrame: start, endFrame: end, leftPx, widthPx };
}

/**
 * Bulk variant for an entire track's elements. Preserves input order for
 * ties so selection outlines stay stable across re-renders. Blocks that
 * fully miss the composition are filtered out.
 */
export function placeTrackElements(
  blocks: readonly ElementBlockInput[],
  durationFrames: number,
  scale: TimelineScale,
): ElementBlockPlacement[] {
  const out: ElementBlockPlacement[] = [];
  for (const block of blocks) {
    const placed = placeElementBlock(block, durationFrames, scale);
    if (placed) out.push(placed);
  }
  return out;
}
