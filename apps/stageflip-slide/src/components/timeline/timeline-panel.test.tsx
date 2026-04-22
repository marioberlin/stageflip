// apps/stageflip-slide/src/components/timeline/timeline-panel.test.tsx
// Rendering + scrub behaviour for the T-126 timeline panel.

import type { Animation, Slide, TextElement } from '@stageflip/schema';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimelinePanel } from './timeline-panel';

afterEach(() => {
  cleanup();
});

function fade(id: string, startFrame: number, durationFrames: number): Animation {
  return {
    id,
    timing: { kind: 'absolute', startFrame, durationFrames },
    animation: { kind: 'fade', from: 0, to: 1, easing: 'linear' },
    autoplay: true,
  } as Animation;
}

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'el',
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    text: 't',
    align: 'left',
    ...overrides,
  } as TextElement;
}

function slideWith(...elements: TextElement[]): Slide {
  return { id: 'slide', elements } as Slide;
}

describe('<TimelinePanel> — layout', () => {
  it('renders a ruler, a track row per element, and a scrubber', () => {
    const slide = slideWith(
      textEl({ id: 'a', name: 'First' }),
      textEl({ id: 'b', name: 'Second' }),
    );
    render(
      <TimelinePanel
        slide={slide}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={() => {}}
      />,
    );
    expect(screen.getByTestId('timeline-panel')).toBeTruthy();
    expect(screen.getByTestId('timeline-ruler')).toBeTruthy();
    expect(screen.getByTestId('timeline-scrubber')).toBeTruthy();
    expect(screen.getByTestId('timeline-track-a')).toBeTruthy();
    expect(screen.getByTestId('timeline-track-b')).toBeTruthy();
  });

  it('renders ruler ticks at the fps cadence for the default zoom', () => {
    render(
      <TimelinePanel
        slide={slideWith(textEl())}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={() => {}}
      />,
    );
    // 100 px/sec at 30 fps → one-second ticks → f0, f30, f60, f90.
    expect(screen.getByTestId('timeline-tick-0')).toBeTruthy();
    expect(screen.getByTestId('timeline-tick-30')).toBeTruthy();
    expect(screen.getByTestId('timeline-tick-60')).toBeTruthy();
    expect(screen.getByTestId('timeline-tick-90')).toBeTruthy();
  });
});

describe('<TimelinePanel> — timing blocks', () => {
  it('renders an absolute timing block sized to the animation window', () => {
    const el = textEl({
      id: 'a',
      animations: [fade('anim-1', 15, 30)],
    });
    render(
      <TimelinePanel
        slide={slideWith(el)}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={() => {}}
      />,
    );
    const block = screen.getByTestId('timeline-block-a-anim-1');
    expect(block.getAttribute('data-timing-kind')).toBe('absolute');
    expect(block.getAttribute('data-start-frame')).toBe('15');
    expect(block.getAttribute('data-duration-frames')).toBe('30');
    // 15 frames @ 30fps * 100 px/s = 50 px
    expect(block.style.left).toBe('50px');
    expect(block.style.width).toBe('100px');
  });

  it('non-absolute timing renders a placeholder with the original kind preserved', () => {
    const el = textEl({
      id: 'a',
      animations: [
        {
          id: 'rel',
          timing: { kind: 'relative', offsetFrames: 0, durationFrames: 15 },
          animation: { kind: 'fade', from: 0, to: 1, easing: 'linear' },
          autoplay: true,
        } as Animation,
      ],
    });
    render(
      <TimelinePanel
        slide={slideWith(el)}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={() => {}}
      />,
    );
    const block = screen.getByTestId('timeline-block-a-rel');
    expect(block.getAttribute('data-timing-kind')).toBe('relative');
  });
});

describe('<TimelinePanel> — scrubber', () => {
  it('positions the scrubber at the frameToPx offset', () => {
    render(
      <TimelinePanel
        slide={slideWith(textEl())}
        fps={30}
        durationInFrames={90}
        currentFrame={30}
        onCurrentFrameChange={() => {}}
      />,
    );
    const scrub = screen.getByTestId('timeline-scrubber');
    expect(scrub.getAttribute('data-current-frame')).toBe('30');
    // 1s at 100 px/sec = 100 px.
    expect(scrub.style.left).toBe('100px');
  });

  it('pointerdown on the hit area scrubs to the click frame', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimelinePanel
        slide={slideWith(textEl())}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={onChange}
      />,
    );
    const hit = screen.getByTestId('timeline-scrubber-hit-area');
    // Stub getBoundingClientRect on the scroll host so click math lands
    // at a deterministic pixel offset in happy-dom (no real layout).
    const scroll = container.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;
    const origRect = scroll.getBoundingClientRect;
    scroll.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 900,
        bottom: 100,
        width: 900,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    try {
      act(() => {
        fireEvent.pointerDown(hit, { pointerId: 1, clientX: 150, clientY: 10 });
      });
      // 150px / 100 px-per-sec = 1.5s * 30 fps = 45 frames.
      expect(onChange).toHaveBeenCalledWith(45);
    } finally {
      scroll.getBoundingClientRect = origRect;
    }
  });

  it('pointermove while pressed continues to drive onCurrentFrameChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimelinePanel
        slide={slideWith(textEl())}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={onChange}
      />,
    );
    const hit = screen.getByTestId('timeline-scrubber-hit-area');
    const scroll = container.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;
    const origRect = scroll.getBoundingClientRect;
    scroll.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 900,
        bottom: 100,
        width: 900,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    try {
      act(() => {
        fireEvent.pointerDown(hit, { pointerId: 1, clientX: 100, clientY: 10 });
        fireEvent.pointerMove(hit, { pointerId: 1, clientX: 200, clientY: 10, buttons: 1 });
      });
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(60);
    } finally {
      scroll.getBoundingClientRect = origRect;
    }
  });

  it('clamps scrub to the valid frame range', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimelinePanel
        slide={slideWith(textEl())}
        fps={30}
        durationInFrames={90}
        currentFrame={0}
        onCurrentFrameChange={onChange}
      />,
    );
    const hit = screen.getByTestId('timeline-scrubber-hit-area');
    const scroll = container.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;
    scroll.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 900,
        bottom: 100,
        width: 900,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    act(() => {
      fireEvent.pointerDown(hit, { pointerId: 1, clientX: 5000, clientY: 10 });
    });
    // 5000 px → way past the 3-second duration. Clamps to 89.
    expect(onChange).toHaveBeenCalledWith(89);
  });
});
