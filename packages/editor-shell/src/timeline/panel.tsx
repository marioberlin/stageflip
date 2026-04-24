// packages/editor-shell/src/timeline/panel.tsx
// Headless panel composition — <Playhead> + <TimelinePanel> (T-181c).
// Layers the ruler, track stack, and playhead in a single positioned
// container and wires a `useScrubber` pointer handler to the ruler row.
// All styling is still opt-in via `className`/`style`/CSS custom props;
// host apps can replace any subtree by passing their own `children`.

'use client';

import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';

import { TimelineRuler, type TimelineRulerProps } from './components';
import { type TimelineScale, frameToPx } from './math';

/* -------------------------------------------------------------------------- */
/* <Playhead>                                                                 */
/* -------------------------------------------------------------------------- */

export interface PlayheadProps {
  readonly scale: TimelineScale;
  readonly currentFrame: number;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

/**
 * Vertical line positioned at `frameToPx(currentFrame, scale)`. The element
 * is `pointer-events: none` by default so it doesn't swallow clicks on the
 * tracks below; host CSS can override via `style`.
 */
export function Playhead(props: PlayheadProps): ReactNode {
  const { scale, currentFrame, className, style, children } = props;
  const leftPx = frameToPx(currentFrame, scale);
  return (
    <div
      className={className}
      data-testid="sf-timeline-playhead"
      data-current-frame={currentFrame}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: leftPx,
        width: 0,
        pointerEvents: 'none',
        ['--sf-tl-playhead-left' as string]: `${leftPx}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <TimelinePanel>                                                            */
/* -------------------------------------------------------------------------- */

export interface TimelinePanelProps {
  readonly scale: TimelineScale;
  readonly durationFrames: number;
  /** Forwarded ruler props (override tickFrames, formatLabel, etc.). */
  readonly rulerProps?: Partial<Omit<TimelineRulerProps, 'scale' | 'durationFrames'>>;
  /** Pointer handler from `useScrubber` — attaches to the ruler surface. */
  readonly onRulerPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Playhead frame, if a <Playhead> should be rendered. Hidden when undefined. */
  readonly currentFrame?: number;
  /** Track-stack + element-blocks content. Rendered below the ruler. */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * The canonical multi-track timeline shell. Composition order, top to bottom:
 *
 *   <div> (relative)
 *     <ruler-row> pointer surface + <TimelineRuler>
 *     <body>      host-supplied tracks stack
 *     <Playhead>  optional, covers ruler + body
 *
 * The panel does **not** own selection, drag-resize, or track-header UI; it
 * is a layout primitive. Host apps compose their own chrome around and inside.
 */
export function TimelinePanel(props: TimelinePanelProps): ReactNode {
  const {
    scale,
    durationFrames,
    rulerProps,
    onRulerPointerDown,
    currentFrame,
    children,
    className,
    style,
  } = props;
  const widthPx = frameToPx(durationFrames, scale);
  return (
    <div
      className={className}
      data-testid="sf-timeline-panel"
      style={{
        position: 'relative',
        width: widthPx,
        ['--sf-tl-panel-width' as string]: `${widthPx}px`,
        ...style,
      }}
    >
      <div
        data-testid="sf-timeline-ruler-row"
        onPointerDown={onRulerPointerDown}
        style={{ position: 'relative', touchAction: 'none' }}
      >
        <TimelineRuler scale={scale} durationFrames={durationFrames} {...rulerProps} />
      </div>
      <div data-testid="sf-timeline-panel-body" style={{ position: 'relative' }}>
        {children}
      </div>
      {currentFrame !== undefined ? <Playhead scale={scale} currentFrame={currentFrame} /> : null}
    </div>
  );
}
