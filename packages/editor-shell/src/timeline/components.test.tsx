// packages/editor-shell/src/timeline/components.test.tsx
// Behavioural tests for the headless timeline primitives (T-181b).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ElementBlock, TimelineRuler, TimelineStack, TrackRow } from './components';
import type { TimelineScale } from './math';
import { type TrackLaneInput, placeElementBlock, trackRowLayout } from './tracks';

afterEach(() => cleanup());

const scale: TimelineScale = { fps: 30, pxPerSecond: 100 };

describe('<TimelineRuler>', () => {
  it('renders a tick at frame 0 + one per interval up to the duration', () => {
    render(<TimelineRuler scale={scale} durationFrames={150} />);
    const root = screen.getByTestId('sf-timeline-ruler');
    expect(root.getAttribute('data-duration-frames')).toBe('150');
    // 1s ticks at fps=30 / 100 px/s → ticks every 30 frames up to 150
    for (const frame of [0, 30, 60, 90, 120, 150]) {
      expect(screen.getByTestId(`sf-timeline-ruler-tick-${frame}`)).toBeTruthy();
    }
  });

  it('uses a tickFrames override when supplied', () => {
    render(<TimelineRuler scale={scale} durationFrames={150} tickFrames={15} />);
    // override → quarter-second ticks (11 of them through 150)
    expect(screen.getByTestId('sf-timeline-ruler-tick-15')).toBeTruthy();
    expect(screen.getByTestId('sf-timeline-ruler-tick-45')).toBeTruthy();
  });

  it('positions each tick absolutely at its pixel offset', () => {
    render(<TimelineRuler scale={scale} durationFrames={150} />);
    const tick30 = screen.getByTestId('sf-timeline-ruler-tick-30');
    expect(tick30.style.left).toBe('100px');
    const tick60 = screen.getByTestId('sf-timeline-ruler-tick-60');
    expect(tick60.style.left).toBe('200px');
  });

  it('accepts a custom label formatter', () => {
    render(<TimelineRuler scale={scale} durationFrames={60} formatLabel={(f) => `f=${f}`} />);
    expect(screen.getByTestId('sf-timeline-ruler-tick-30').textContent).toBe('f=30');
  });
});

describe('<TimelineStack>', () => {
  const tracks: TrackLaneInput[] = [
    { id: 'v1', kind: 'visual' },
    { id: 'a1', kind: 'audio' },
  ];

  it('renders one child per row and sizes to the total stack height', () => {
    const rows = trackRowLayout(tracks);
    const { container } = render(
      <TimelineStack rows={rows}>{(row) => <TrackRow key={row.id} row={row} />}</TimelineStack>,
    );
    expect(screen.getByTestId('sf-timeline-stack')).toBeTruthy();
    expect(screen.getByTestId('sf-timeline-track-v1')).toBeTruthy();
    expect(screen.getByTestId('sf-timeline-track-a1')).toBeTruthy();
    const stack = container.querySelector('[data-testid="sf-timeline-stack"]') as HTMLElement;
    // visual 72 + audio 56 = 128
    expect(stack.style.height).toBe('128px');
  });

  it('is empty when no rows', () => {
    render(<TimelineStack rows={[]}>{(row) => <TrackRow key={row.id} row={row} />}</TimelineStack>);
    const stack = screen.getByTestId('sf-timeline-stack');
    expect(stack.style.height).toBe('0px');
  });
});

describe('<TrackRow>', () => {
  it('positions absolutely by the placement geometry', () => {
    const rows = trackRowLayout([
      { id: 'v1', kind: 'visual' },
      { id: 'a1', kind: 'audio' },
    ]);
    const visualRow = rows[0];
    const audioRow = rows[1];
    if (!visualRow || !audioRow) throw new Error('layout failed');
    render(
      <>
        <TrackRow row={visualRow} />
        <TrackRow row={audioRow} />
      </>,
    );
    const v = screen.getByTestId('sf-timeline-track-v1');
    const a = screen.getByTestId('sf-timeline-track-a1');
    expect(v.style.top).toBe('0px');
    expect(v.style.height).toBe('72px');
    expect(a.style.top).toBe('72px');
    expect(a.style.height).toBe('56px');
    expect(v.getAttribute('data-track-kind')).toBe('visual');
    expect(a.getAttribute('data-track-kind')).toBe('audio');
    expect(v.getAttribute('data-track-index')).toBe('0');
    expect(a.getAttribute('data-track-index')).toBe('1');
  });

  it('renders provided children', () => {
    const rows = trackRowLayout([{ id: 'v1', kind: 'visual' }]);
    const row = rows[0];
    if (!row) throw new Error('layout failed');
    render(
      <TrackRow row={row}>
        <span data-testid="sentinel">content</span>
      </TrackRow>,
    );
    expect(screen.getByTestId('sentinel').textContent).toBe('content');
  });
});

describe('<ElementBlock>', () => {
  it('positions absolutely by placement left/width', () => {
    const placement = placeElementBlock(
      { elementId: 'e1', startFrame: 30, endFrame: 60 },
      300,
      scale,
    );
    if (!placement) throw new Error('placement missing');
    render(<ElementBlock placement={placement} />);
    const block = screen.getByTestId('sf-timeline-block-e1');
    expect(block.style.left).toBe('100px');
    expect(block.style.width).toBe('100px');
    expect(block.getAttribute('data-selected')).toBe('false');
  });

  it('reflects the selected flag in data-selected', () => {
    const placement = placeElementBlock(
      { elementId: 'e1', startFrame: 0, endFrame: 30 },
      300,
      scale,
    );
    if (!placement) throw new Error('placement missing');
    render(<ElementBlock placement={placement} selected />);
    expect(screen.getByTestId('sf-timeline-block-e1').getAttribute('data-selected')).toBe('true');
  });
});
