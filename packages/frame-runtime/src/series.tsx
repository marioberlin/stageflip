// packages/frame-runtime/src/series.tsx
// <Series> + <Series.Sequence> — declarative chain of sequences. Each
// <Series.Sequence> declares a duration (and optional offset); Series sums
// durations + offsets to auto-compute the `from` for every child, rendering
// each as a <Sequence> internally.
//
// <Series.Sequence> is a marker component. It is NOT rendered directly — the
// enclosing <Series> reads its props and renders a <Sequence>. Attempting to
// render <Series.Sequence> outside a Series throws.
//
// Design mirrors https://remotion.dev/docs/series (per CLAUDE.md §7 rules:
// read public docs, reimplement from scratch).

import {
  Children,
  Fragment,
  type ReactElement,
  type ReactNode,
  createElement,
  isValidElement,
} from 'react';

import { Sequence, type SequenceLayout } from './sequence.js';

export interface SeriesSequenceProps {
  children?: ReactNode;
  /** Length of this segment in frames. Positive integer. Infinity only allowed on the final child. */
  durationInFrames: number;
  /** Signed integer delta applied to this segment's auto-computed `from`. Default 0. */
  offset?: number;
  /** Optional debug label; forwarded to the inner Sequence. */
  name?: string;
  /** Layout strategy; forwarded to the inner Sequence. Default `'absolute-fill'`. */
  layout?: SequenceLayout;
}

/**
 * Marker component — only valid as a direct child of <Series>. Rendering it
 * standalone throws. The duration + offset props are consumed by the enclosing
 * <Series> to compute the segment's `from`.
 */
export function SeriesSequence(_props: SeriesSequenceProps): ReactElement {
  throw new Error(
    'Series.Sequence: must be used as a direct child of <Series>. Did you forget to wrap in <Series>?',
  );
}
SeriesSequence.displayName = 'Series.Sequence';

export interface SeriesProps {
  children?: ReactNode;
}

/**
 * Chain of sequences. Iterates children (each must be a <Series.Sequence>),
 * sums `durationInFrames + offset` to compute each segment's `from`, and
 * emits a <Sequence> per segment.
 *
 * @throws If any child is not a <Series.Sequence>, if a non-final child has
 *   `durationInFrames: Infinity`, or if any segment's `durationInFrames` /
 *   `offset` fails the per-child validators.
 */
function SeriesFn({ children }: SeriesProps): ReactElement {
  const segments = collectSegments(children);

  let cursor = 0;
  const rendered: ReactElement[] = segments.map((seg, i) => {
    const from = cursor + seg.offset;
    // Advance cursor by duration (Infinity is only valid on the last segment,
    // so we never read cursor past that point).
    cursor = from + seg.durationInFrames;
    return createElement(
      Sequence,
      {
        key: seg.key ?? i,
        from,
        durationInFrames: seg.durationInFrames,
        ...(seg.name !== undefined ? { name: seg.name } : {}),
        ...(seg.layout !== undefined ? { layout: seg.layout } : {}),
      },
      seg.children,
    );
  });

  return createElement(Fragment, null, ...rendered);
}

interface CollectedSegment {
  durationInFrames: number;
  offset: number;
  name?: string;
  layout?: SequenceLayout;
  children?: ReactNode;
  key: string | number | null;
}

function collectSegments(children: ReactNode): CollectedSegment[] {
  const out: CollectedSegment[] = [];

  const elements: ReactElement[] = [];
  Children.forEach(children, (child) => {
    // Skip conditional-render falsy values.
    if (child === null || child === undefined || child === false || child === true) return;
    if (!isValidElement(child) || child.type !== SeriesSequence) {
      throw new Error(
        'Series: children must all be <Series.Sequence> elements (or null/false for conditional rendering).',
      );
    }
    elements.push(child);
  });

  elements.forEach((el, i) => {
    const props = el.props as SeriesSequenceProps;
    const isLast = i === elements.length - 1;
    const duration = props.durationInFrames;
    const offset = props.offset ?? 0;

    if (duration === Number.POSITIVE_INFINITY) {
      if (!isLast) {
        throw new Error(
          `Series.Sequence: durationInFrames=Infinity is only valid on the last child (got at index ${i} of ${elements.length}).`,
        );
      }
    } else {
      if (!Number.isInteger(duration)) {
        throw new Error(
          `Series.Sequence: durationInFrames must be an integer (got ${duration} at index ${i})`,
        );
      }
      if (duration <= 0) {
        throw new Error(
          `Series.Sequence: durationInFrames must be positive (got ${duration} at index ${i})`,
        );
      }
    }

    if (!Number.isInteger(offset)) {
      throw new Error(`Series.Sequence: offset must be an integer (got ${offset} at index ${i})`);
    }

    const seg: CollectedSegment = {
      durationInFrames: duration,
      offset,
      key: el.key,
    };
    if (props.name !== undefined) seg.name = props.name;
    if (props.layout !== undefined) seg.layout = props.layout;
    if (props.children !== undefined) seg.children = props.children;

    out.push(seg);
  });

  return out;
}

/**
 * Exported symbol. `Object.assign` attaches the marker component so the
 * ergonomic `<Series.Sequence>` JSX form is valid.
 */
export const Series = Object.assign(SeriesFn, { Sequence: SeriesSequence });

export type SeriesComponent = typeof Series;
