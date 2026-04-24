// packages/editor-shell/src/timeline/components.tsx
// Headless React primitives for the multi-track timeline (T-181b).
//
// Four components, each opinion-free enough to be themed by the host app:
//
//  - <TimelineRuler>  — horizontal ruler with ticks + labels.
//  - <TimelineStack>  — wraps <TrackRow>s stacked top-to-bottom.
//  - <TrackRow>       — one track row, positioned absolutely by
//                       `topPx` / `heightPx` from the layout math.
//  - <ElementBlock>   — a clip-block inside a track row.
//
// None of them import app-specific CSS. Styling hooks are:
//   - `className` + `style` props on every component.
//   - `data-testid` for test selection.
//   - CSS custom properties where numeric geometry flows out
//     (`--sf-tl-tick-px`, `--sf-tl-row-top`, etc.) so host CSS can
//     read them with `var(--sf-tl-tick-px)`.

'use client';

import type { CSSProperties, ReactNode } from 'react';

import { type TimelineScale, formatFrameLabel, frameToPx, rulerTickFrames } from './math';
import type { ElementBlockPlacement, TimelineTrackKind, TrackRowPlacement } from './tracks';

/* -------------------------------------------------------------------------- */
/* <TimelineRuler>                                                            */
/* -------------------------------------------------------------------------- */

export interface TimelineRulerProps {
  readonly scale: TimelineScale;
  readonly durationFrames: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Optional override for tick spacing, in frames. Falls back to `rulerTickFrames`. */
  readonly tickFrames?: number;
  /** Optional label formatter. Falls back to `formatFrameLabel`. */
  readonly formatLabel?: (frame: number, fps: number) => string;
}

/**
 * Renders tick marks + labels spanning `[0, durationFrames]`. The outer
 * element is positioned relatively; tick spans are positioned absolutely
 * so the ruler has no flex/grid dependency on the host.
 */
export function TimelineRuler(props: TimelineRulerProps): ReactNode {
  const {
    scale,
    durationFrames,
    className,
    style,
    tickFrames: tickOverride,
    formatLabel = formatFrameLabel,
  } = props;
  const tick = tickOverride && tickOverride > 0 ? tickOverride : rulerTickFrames(scale);
  const totalPx = frameToPx(durationFrames, scale);

  const ticks: Array<{ frame: number; px: number; label: string }> = [];
  for (let frame = 0; frame <= durationFrames; frame += tick) {
    ticks.push({ frame, px: frameToPx(frame, scale), label: formatLabel(frame, scale.fps) });
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', width: totalPx, ...style }}
      data-testid="sf-timeline-ruler"
      data-duration-frames={durationFrames}
    >
      {ticks.map((t) => (
        <span
          key={t.frame}
          data-testid={`sf-timeline-ruler-tick-${t.frame}`}
          style={{
            position: 'absolute',
            left: t.px,
            ['--sf-tl-tick-px' as string]: `${t.px}px`,
          }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <TimelineStack>                                                            */
/* -------------------------------------------------------------------------- */

export interface TimelineStackProps {
  readonly rows: readonly TrackRowPlacement[];
  readonly children: (row: TrackRowPlacement) => ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Renders one child per row, stacked by absolute `top` / `height`. The
 * caller's render prop receives the full placement so it can pass the
 * same object to `<TrackRow>` unchanged.
 */
export function TimelineStack(props: TimelineStackProps): ReactNode {
  const { rows, children, className, style } = props;
  const totalHeight =
    rows.length === 0
      ? 0
      : (rows[rows.length - 1]?.topPx ?? 0) + (rows[rows.length - 1]?.heightPx ?? 0);
  return (
    <div
      className={className}
      style={{ position: 'relative', height: totalHeight, ...style }}
      data-testid="sf-timeline-stack"
    >
      {rows.map((row) => children(row))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <TrackRow>                                                                 */
/* -------------------------------------------------------------------------- */

export interface TrackRowProps {
  readonly row: TrackRowPlacement;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Absolutely-positioned row band. Host provides children (element blocks,
 * selection overlay, …). The element exposes the row's `kind`, `index`,
 * `id`, and geometry via `data-*` attributes for styling + tests.
 */
export function TrackRow(props: TrackRowProps): ReactNode {
  const { row, children, className, style } = props;
  const kindClass: TimelineTrackKind = row.kind;
  return (
    <div
      className={className}
      data-testid={`sf-timeline-track-${row.id}`}
      data-track-id={row.id}
      data-track-kind={kindClass}
      data-track-index={row.index}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: row.topPx,
        height: row.heightPx,
        ['--sf-tl-row-top' as string]: `${row.topPx}px`,
        ['--sf-tl-row-height' as string]: `${row.heightPx}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <ElementBlock>                                                             */
/* -------------------------------------------------------------------------- */

export interface ElementBlockProps {
  readonly placement: ElementBlockPlacement;
  readonly selected?: boolean;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * A horizontally-positioned block inside a `<TrackRow>`. Geometry comes
 * from `placeElementBlock`; host owns content (label, waveform thumb,
 * caption text, …) through `children`.
 */
export function ElementBlock(props: ElementBlockProps): ReactNode {
  const { placement, selected = false, children, className, style } = props;
  return (
    <div
      className={className}
      data-testid={`sf-timeline-block-${placement.elementId}`}
      data-element-id={placement.elementId}
      data-selected={selected ? 'true' : 'false'}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: placement.leftPx,
        width: placement.widthPx,
        ['--sf-tl-block-left' as string]: `${placement.leftPx}px`,
        ['--sf-tl-block-width' as string]: `${placement.widthPx}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
