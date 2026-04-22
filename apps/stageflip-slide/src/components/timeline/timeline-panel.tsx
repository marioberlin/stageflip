// apps/stageflip-slide/src/components/timeline/timeline-panel.tsx
// Horizontal timeline with ruler, tracks, and scrubber (T-126).

'use client';

import type { Animation, Element, Slide } from '@stageflip/schema';
import type { CSSProperties, ReactElement, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import {
  type TimelineScale,
  formatFrameLabel,
  frameToPx,
  pxToFrame,
  rulerTickFrames,
} from './timeline-math';

/**
 * Controlled timeline panel — no editor-shell atom subscriptions;
 * parents supply `currentFrame` + `onCurrentFrameChange`. T-126's
 * audit note: "is a controlled component (parent passes state +
 * callbacks). The cleanest port." Keeps this panel reusable across
 * edit mode and preview mode, and trivial to swap the parent driver
 * (T-123d `<SlidePlayer>` scrub seam, later T-133 undo).
 */

export interface TimelinePanelProps {
  slide: Slide;
  fps: number;
  durationInFrames: number;
  currentFrame: number;
  onCurrentFrameChange: (frame: number) => void;
  /** Default 100. The ruler + tracks scale linearly from this value. */
  pxPerSecond?: number;
}

const DEFAULT_PX_PER_SECOND = 100;
const TRACK_HEIGHT_PX = 28;
const RULER_HEIGHT_PX = 22;

export function TimelinePanel({
  slide,
  fps,
  durationInFrames,
  currentFrame,
  onCurrentFrameChange,
  pxPerSecond = DEFAULT_PX_PER_SECOND,
}: TimelinePanelProps): ReactElement {
  const scale: TimelineScale = useMemo(() => ({ fps, pxPerSecond }), [fps, pxPerSecond]);
  const totalWidth = frameToPx(durationInFrames, scale);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleScrubberPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const host = scrollRef.current;
      if (!host) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = host.getBoundingClientRect();
      const apply = (clientX: number): void => {
        const local = clientX - rect.left + host.scrollLeft;
        const frame = Math.min(durationInFrames - 1, Math.max(0, pxToFrame(local, scale)));
        onCurrentFrameChange(frame);
      };
      apply(event.clientX);
    },
    [durationInFrames, onCurrentFrameChange, scale],
  );

  const handleScrubberMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Pointer capture is implicitly asserted by the browser — the
      // caller only receives move events when the pointer is down.
      if (event.buttons === 0) return;
      handleScrubberPointer(event);
    },
    [handleScrubberPointer],
  );

  return (
    <section data-testid="timeline-panel" aria-label="Timeline" style={panelStyle}>
      <div ref={scrollRef} data-testid="timeline-scroll" style={scrollStyle}>
        <div style={canvasStyle(totalWidth, slide.elements.length)}>
          <Ruler scale={scale} durationInFrames={durationInFrames} />
          <TracksLayer elements={slide.elements} scale={scale} />
          <Scrubber
            currentFrame={currentFrame}
            scale={scale}
            durationInFrames={durationInFrames}
            trackCount={slide.elements.length}
            onPointerDown={handleScrubberPointer}
            onPointerMove={handleScrubberMove}
          />
        </div>
      </div>
      <div style={readoutStyle} aria-live="polite" data-testid="timeline-readout">
        <span>frame {Math.round(currentFrame)}</span>
        <span> · {formatFrameLabel(currentFrame, fps)}</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ruler
// ---------------------------------------------------------------------------

function Ruler({
  scale,
  durationInFrames,
}: {
  scale: TimelineScale;
  durationInFrames: number;
}): ReactElement {
  const tickEvery = rulerTickFrames(scale);
  const ticks: number[] = [];
  for (let f = 0; f <= durationInFrames; f += tickEvery) ticks.push(f);
  if (ticks[ticks.length - 1] !== durationInFrames) ticks.push(durationInFrames);

  return (
    <div data-testid="timeline-ruler" style={rulerStyle}>
      {ticks.map((f) => (
        <div
          key={f}
          data-testid={`timeline-tick-${f}`}
          style={{ ...tickStyle, left: frameToPx(f, scale) }}
        >
          <span style={tickLabelStyle}>{formatFrameLabel(f, scale.fps)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

function TracksLayer({
  elements,
  scale,
}: {
  elements: ReadonlyArray<Element>;
  scale: TimelineScale;
}): ReactElement {
  return (
    <div data-testid="timeline-tracks" style={tracksStyle}>
      {elements.map((el, idx) => (
        <Track key={el.id} element={el} index={idx} scale={scale} />
      ))}
    </div>
  );
}

function Track({
  element,
  index,
  scale,
}: {
  element: Element;
  index: number;
  scale: TimelineScale;
}): ReactElement {
  return (
    <div
      data-testid={`timeline-track-${element.id}`}
      data-track-index={index}
      style={{
        ...trackRowStyle,
        top: RULER_HEIGHT_PX + index * TRACK_HEIGHT_PX,
      }}
    >
      <span style={trackLabelStyle}>{element.name ?? element.id}</span>
      {element.animations.map((anim) => (
        <TimingBlock key={anim.id} element={element} anim={anim} scale={scale} />
      ))}
    </div>
  );
}

function TimingBlock({
  element,
  anim,
  scale,
}: {
  element: Element;
  anim: Animation;
  scale: TimelineScale;
}): ReactElement | null {
  // Only `absolute` timings render a concrete block in this iteration.
  // Relative / anchored / beat / event need a compile pass (T-030) to
  // resolve to absolute windows; they render as a diagonal-striped
  // placeholder at the element's far-left so consumers see the track
  // is populated.
  if (anim.timing.kind !== 'absolute') {
    return (
      <span
        data-testid={`timeline-block-${element.id}-${anim.id}`}
        data-anim-kind={anim.animation.kind}
        data-timing-kind={anim.timing.kind}
        style={{ ...unresolvedBlockStyle, left: 0 }}
      />
    );
  }
  const { startFrame, durationFrames } = anim.timing;
  return (
    <span
      data-testid={`timeline-block-${element.id}-${anim.id}`}
      data-anim-kind={anim.animation.kind}
      data-timing-kind="absolute"
      data-start-frame={startFrame}
      data-duration-frames={durationFrames}
      style={{
        ...blockStyle,
        left: frameToPx(startFrame, scale),
        width: Math.max(2, frameToPx(durationFrames, scale)),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Scrubber
// ---------------------------------------------------------------------------

function Scrubber({
  currentFrame,
  scale,
  durationInFrames,
  trackCount,
  onPointerDown,
  onPointerMove,
}: {
  currentFrame: number;
  scale: TimelineScale;
  durationInFrames: number;
  trackCount: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
}): ReactElement {
  const x = frameToPx(currentFrame, scale);
  const height = RULER_HEIGHT_PX + Math.max(1, trackCount) * TRACK_HEIGHT_PX;
  return (
    <>
      <div
        data-testid="timeline-scrubber-hit-area"
        role="presentation"
        style={{ ...hitAreaStyle, width: frameToPx(durationInFrames, scale) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      />
      <div
        data-testid="timeline-scrubber"
        data-current-frame={currentFrame}
        style={{ ...scrubberStyle, left: x, height }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: '#151c23',
  borderTop: '1px solid rgba(129, 174, 255, 0.08)',
  fontSize: 12,
  color: '#a5acb4',
};

const scrollStyle: CSSProperties = {
  position: 'relative',
  overflow: 'auto',
  maxHeight: 280,
};

function canvasStyle(width: number, trackCount: number): CSSProperties {
  const height = RULER_HEIGHT_PX + Math.max(1, trackCount) * TRACK_HEIGHT_PX;
  return {
    position: 'relative',
    width,
    height,
    minWidth: '100%',
  };
}

const rulerStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  height: RULER_HEIGHT_PX,
  borderBottom: '1px solid rgba(129, 174, 255, 0.12)',
};

const tickStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  width: 1,
  height: RULER_HEIGHT_PX,
  background: 'rgba(165, 172, 180, 0.2)',
};

const tickLabelStyle: CSSProperties = {
  position: 'absolute',
  left: 4,
  top: 2,
  whiteSpace: 'nowrap',
  fontSize: 10,
  color: '#a5acb4',
};

const tracksStyle: CSSProperties = {
  position: 'absolute',
  top: RULER_HEIGHT_PX,
  left: 0,
  right: 0,
  bottom: 0,
};

const trackRowStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: TRACK_HEIGHT_PX,
  borderBottom: '1px solid rgba(129, 174, 255, 0.04)',
};

const trackLabelStyle: CSSProperties = {
  position: 'sticky',
  left: 0,
  display: 'inline-block',
  paddingLeft: 8,
  lineHeight: `${TRACK_HEIGHT_PX}px`,
  color: '#ebf1fa',
  fontWeight: 500,
  pointerEvents: 'none',
};

const blockStyle: CSSProperties = {
  position: 'absolute',
  top: 4,
  height: TRACK_HEIGHT_PX - 8,
  background: 'linear-gradient(135deg, rgba(129,174,255,0.9), rgba(0,114,229,0.9))',
  borderRadius: 4,
};

const unresolvedBlockStyle: CSSProperties = {
  position: 'absolute',
  top: 4,
  height: TRACK_HEIGHT_PX - 8,
  width: 40,
  background:
    'repeating-linear-gradient(45deg, rgba(129,174,255,0.25) 0 6px, rgba(129,174,255,0.05) 6px 12px)',
  borderRadius: 4,
};

const hitAreaStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  height: RULER_HEIGHT_PX,
  cursor: 'ew-resize',
};

const scrubberStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  width: 2,
  background: '#5af8fb',
  pointerEvents: 'none',
  boxShadow: '0 0 8px rgba(90, 248, 251, 0.6)',
};

const readoutStyle: CSSProperties = {
  padding: '6px 12px',
  borderTop: '1px solid rgba(129, 174, 255, 0.04)',
  fontVariantNumeric: 'tabular-nums',
};
