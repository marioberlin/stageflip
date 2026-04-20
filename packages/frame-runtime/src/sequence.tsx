// packages/frame-runtime/src/sequence.tsx
// <Sequence> — mount gate + frame remap. A sequence is active when the
// parent frame falls inside [from, from + durationInFrames); outside that
// window the children are NOT mounted (zero component instances, zero
// rendered DOM). Inside the window, a nested FrameProvider remaps
// useCurrentFrame() to (parentFrame - from) so children can be written
// against local time starting at frame 0.
//
// Design mirrors the shape documented in https://remotion.dev/docs/sequence
// (per CLAUDE.md §7 rules: read public docs, reimplement from scratch).

import { type ReactElement, type ReactNode, createElement } from 'react';

import { FrameProvider, useCurrentFrame, useVideoConfig } from './frame-context.js';

export type SequenceLayout = 'absolute-fill' | 'none';

export interface SequenceProps {
  children?: ReactNode;
  /** Global frame index at which the sequence starts. Integer; may be negative. Default 0. */
  from?: number;
  /** Length of the sequence in frames. Non-negative integer or Infinity. Default Infinity. */
  durationInFrames?: number;
  /** Optional debug label; rendered as `data-stageflip-sequence` on the wrapper. */
  name?: string;
  /** `'absolute-fill'` wraps in an absolutely positioned div; `'none'` renders children directly. Default `'absolute-fill'`. */
  layout?: SequenceLayout;
}

/**
 * Frame-windowed mount gate. Children mount only while
 * `from ≤ parentFrame < from + durationInFrames`; inside that window they
 * see a remapped `useCurrentFrame()` starting at 0.
 *
 * @throws If `from` is non-integer, `durationInFrames` is negative or
 *   non-integer (except Infinity), or the component is rendered outside a
 *   `FrameProvider`.
 */
export function Sequence({
  children,
  from = 0,
  durationInFrames = Number.POSITIVE_INFINITY,
  name,
  layout = 'absolute-fill',
}: SequenceProps): ReactElement | null {
  if (!Number.isInteger(from)) {
    throw new Error(`Sequence: from must be an integer (got ${from})`);
  }
  if (durationInFrames !== Number.POSITIVE_INFINITY) {
    if (!Number.isInteger(durationInFrames)) {
      throw new Error(
        `Sequence: durationInFrames must be an integer or Infinity (got ${durationInFrames})`,
      );
    }
    if (durationInFrames < 0) {
      throw new Error(`Sequence: durationInFrames must be non-negative (got ${durationInFrames})`);
    }
  }

  const parentFrame = useCurrentFrame();
  const config = useVideoConfig();

  const sequenceFrame = parentFrame - from;
  const active = sequenceFrame >= 0 && sequenceFrame < durationInFrames;
  if (!active) return null;

  const inner = createElement(FrameProvider, { frame: sequenceFrame, config, children });

  if (layout === 'none') {
    return inner as ReactElement;
  }

  return createElement(
    'div',
    {
      'data-stageflip-sequence': name ?? '',
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
