// packages/frame-runtime/src/loop.tsx
// <Loop> — repeats children for a fixed number of iterations (default
// Infinity). Inner `useCurrentFrame()` returns the per-iteration frame
// (`parentFrame % durationInFrames`). Outside the total window
// (`parentFrame < 0` or, for finite `times`, `parentFrame >= times * duration`)
// the children are NOT mounted.
//
// Design mirrors https://remotion.dev/docs/loop (per CLAUDE.md §7 rules:
// read public docs, reimplement from scratch).

import { type ReactElement, type ReactNode, createElement } from 'react';

import { FrameProvider, useCurrentFrame, useVideoConfig } from './frame-context.js';
import type { SequenceLayout } from './sequence.js';

export interface LoopProps {
  children?: ReactNode;
  /** Length of a single iteration in frames. Positive integer. Required. */
  durationInFrames: number;
  /** Number of iterations. Non-negative integer or Infinity. Default Infinity. */
  times?: number;
  /** Optional debug label; rendered as `data-stageflip-loop` on the wrapper. */
  name?: string;
  /** Layout strategy; matches Sequence. Default `'absolute-fill'`. */
  layout?: SequenceLayout;
}

/**
 * Frame-looped mount gate. Mounts children during
 * `[0, times * durationInFrames)` with `useCurrentFrame()` re-mapped to
 * `parentFrame % durationInFrames`.
 *
 * @throws If `durationInFrames` is non-positive or non-integer, `times` is
 *   negative or a non-integer finite value, or the component is rendered
 *   outside a `FrameProvider`.
 */
export function Loop({
  children,
  durationInFrames,
  times = Number.POSITIVE_INFINITY,
  name,
  layout = 'absolute-fill',
}: LoopProps): ReactElement | null {
  if (!Number.isInteger(durationInFrames)) {
    throw new Error(`Loop: durationInFrames must be an integer (got ${durationInFrames})`);
  }
  if (durationInFrames <= 0) {
    throw new Error(`Loop: durationInFrames must be positive (got ${durationInFrames})`);
  }
  if (times !== Number.POSITIVE_INFINITY) {
    if (!Number.isInteger(times)) {
      throw new Error(`Loop: times must be an integer or Infinity (got ${times})`);
    }
    if (times < 0) {
      throw new Error(`Loop: times must be non-negative (got ${times})`);
    }
  }

  const parentFrame = useCurrentFrame();
  const config = useVideoConfig();

  if (parentFrame < 0) return null;
  if (times !== Number.POSITIVE_INFINITY && parentFrame >= durationInFrames * times) {
    return null;
  }

  const innerFrame = parentFrame % durationInFrames;
  const inner = createElement(FrameProvider, { frame: innerFrame, config, children });

  if (layout === 'none') {
    return inner as ReactElement;
  }

  return createElement(
    'div',
    {
      'data-stageflip-loop': name ?? '',
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
    },
    inner,
  );
}
