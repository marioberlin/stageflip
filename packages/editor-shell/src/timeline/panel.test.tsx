// packages/editor-shell/src/timeline/panel.test.tsx
// Behavioural tests for <Playhead> + <TimelinePanel> (T-181c).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TimelineScale } from './math';
import { Playhead, TimelinePanel } from './panel';

afterEach(() => cleanup());

const scale: TimelineScale = { fps: 30, pxPerSecond: 100 };

describe('<Playhead>', () => {
  it('positions at frameToPx(currentFrame, scale)', () => {
    render(<Playhead scale={scale} currentFrame={60} />);
    const ph = screen.getByTestId('sf-timeline-playhead');
    expect(ph.style.left).toBe('200px');
    expect(ph.getAttribute('data-current-frame')).toBe('60');
  });

  it('is pointer-events: none by default (does not swallow track clicks)', () => {
    render(<Playhead scale={scale} currentFrame={0} />);
    const ph = screen.getByTestId('sf-timeline-playhead');
    expect(ph.style.pointerEvents).toBe('none');
  });

  it('renders children inside the playhead line', () => {
    render(
      <Playhead scale={scale} currentFrame={0}>
        <span data-testid="ph-knob">•</span>
      </Playhead>,
    );
    expect(screen.getByTestId('ph-knob')).toBeTruthy();
  });
});

describe('<TimelinePanel>', () => {
  it('renders ruler, body, and sizes to composition width', () => {
    render(
      <TimelinePanel scale={scale} durationFrames={150}>
        <span data-testid="body-child">tracks</span>
      </TimelinePanel>,
    );
    const panel = screen.getByTestId('sf-timeline-panel');
    expect(panel.style.width).toBe('500px'); // 150 frames / 30fps * 100px/s
    expect(screen.getByTestId('sf-timeline-ruler')).toBeTruthy();
    expect(screen.getByTestId('sf-timeline-ruler-row')).toBeTruthy();
    expect(screen.getByTestId('sf-timeline-panel-body')).toBeTruthy();
    expect(screen.getByTestId('body-child')).toBeTruthy();
  });

  it('omits the playhead when currentFrame is undefined', () => {
    render(<TimelinePanel scale={scale} durationFrames={150} />);
    expect(screen.queryByTestId('sf-timeline-playhead')).toBeNull();
  });

  it('renders the playhead when currentFrame is provided', () => {
    render(<TimelinePanel scale={scale} durationFrames={150} currentFrame={30} />);
    const ph = screen.getByTestId('sf-timeline-playhead');
    expect(ph.style.left).toBe('100px');
  });

  it('forwards rulerProps (tickFrames override)', () => {
    render(<TimelinePanel scale={scale} durationFrames={60} rulerProps={{ tickFrames: 15 }} />);
    expect(screen.getByTestId('sf-timeline-ruler-tick-15')).toBeTruthy();
    expect(screen.getByTestId('sf-timeline-ruler-tick-45')).toBeTruthy();
  });

  it('dispatches pointerdown on the ruler row to onRulerPointerDown', () => {
    const handler = vi.fn();
    render(<TimelinePanel scale={scale} durationFrames={150} onRulerPointerDown={handler} />);
    const rulerRow = screen.getByTestId('sf-timeline-ruler-row');
    fireEvent.pointerDown(rulerRow, { button: 0, clientX: 100, pointerId: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
