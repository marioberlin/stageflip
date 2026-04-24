// packages/editor-shell/src/timeline/use-scrubber.test.tsx
// Behavioural pins for useScrubber (T-181c).

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TimelineScale } from './math';
import { useScrubber } from './use-scrubber';

afterEach(() => cleanup());

const scale: TimelineScale = { fps: 30, pxPerSecond: 100 };
const duration = 30 * 10; // 10s at 30fps

function Harness(props: {
  readonly initialFrame?: number;
  readonly snapFrames?: number;
  readonly onChange?: (frame: number) => void;
}): JSX.Element {
  const scrubber = useScrubber({
    scale,
    durationFrames: duration,
    initialFrame: props.initialFrame,
    snapFrames: props.snapFrames,
    onChange: props.onChange,
  });
  return (
    <div
      data-testid="scrub"
      onPointerDown={(e) => scrubber.onPointerDown(e as ReactPointerEvent<HTMLElement>)}
      style={{ width: 1000 }}
    >
      <span data-testid="frame">{scrubber.currentFrame}</span>
      <span data-testid="dragging">{scrubber.dragging ? 'yes' : 'no'}</span>
    </div>
  );
}

/** Mock the surface's bounding rect so pxToFrame math is deterministic. */
function stubRect(el: HTMLElement, left: number, width: number) {
  el.getBoundingClientRect = () =>
    ({
      left,
      top: 0,
      right: left + width,
      bottom: 40,
      width,
      height: 40,
      x: left,
      y: 0,
      toJSON: () => '',
    }) as DOMRect;
}

describe('useScrubber', () => {
  it('starts at initialFrame=0 by default, not dragging', () => {
    render(<Harness />);
    expect(screen.getByTestId('frame').textContent).toBe('0');
    expect(screen.getByTestId('dragging').textContent).toBe('no');
  });

  it('clamps an out-of-range initialFrame', () => {
    render(<Harness initialFrame={9999} />);
    expect(screen.getByTestId('frame').textContent).toBe(`${duration}`);
  });

  it('seeks on pointerdown at the pointer x', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const surface = screen.getByTestId('scrub');
    stubRect(surface, 0, 1000);
    // 200px at 100 px/s / 30 fps → 60 frames
    fireEvent.pointerDown(surface, { button: 0, clientX: 200, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe('60');
    expect(onChange).toHaveBeenCalledWith(60);
    expect(screen.getByTestId('dragging').textContent).toBe('yes');
  });

  it('clamps seek to [0, durationFrames]', () => {
    render(<Harness />);
    const surface = screen.getByTestId('scrub');
    stubRect(surface, 0, 1000);
    fireEvent.pointerDown(surface, { button: 0, clientX: -200, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe('0');
    fireEvent.pointerDown(surface, { button: 0, clientX: 99999, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe(`${duration}`);
  });

  it('ignores non-left clicks', () => {
    render(<Harness />);
    const surface = screen.getByTestId('scrub');
    stubRect(surface, 0, 1000);
    fireEvent.pointerDown(surface, { button: 2, clientX: 200, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe('0');
    expect(screen.getByTestId('dragging').textContent).toBe('no');
  });

  it('snaps to snapFrames when enabled', () => {
    render(<Harness snapFrames={15} />);
    const surface = screen.getByTestId('scrub');
    stubRect(surface, 0, 1000);
    // 250px → 75 frames, snap-15 → 75 (already aligned)
    fireEvent.pointerDown(surface, { button: 0, clientX: 250, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe('75');
    // 230px → 69 frames, snap-15 → 75 (rounded to nearest 15)
    fireEvent.pointerDown(surface, { button: 0, clientX: 230, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe('75');
  });

  it('follows the cursor via document pointermove while dragging', () => {
    render(<Harness />);
    const surface = screen.getByTestId('scrub');
    stubRect(surface, 0, 1000);
    fireEvent.pointerDown(surface, { button: 0, clientX: 0, pointerId: 1 });
    expect(screen.getByTestId('frame').textContent).toBe('0');
    act(() => {
      surface.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 300, pointerId: 1, bubbles: true }),
      );
    });
    expect(screen.getByTestId('frame').textContent).toBe('90');
    act(() => {
      surface.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 300, pointerId: 1, bubbles: true }),
      );
    });
    expect(screen.getByTestId('dragging').textContent).toBe('no');
  });
});
