// apps/stageflip-slide/src/components/canvas/slide-player.test.tsx
// Covers animation application at specific frames + playback via rAF.

import type { Animation, Slide, TextElement } from '@stageflip/schema';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlidePlayer, applyAnimationsAtFrame } from './slide-player';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fade(opts: {
  id?: string;
  start: number;
  duration: number;
  from?: number;
  to?: number;
}): Animation {
  return {
    id: opts.id ?? 'anim',
    timing: { kind: 'absolute', startFrame: opts.start, durationFrames: opts.duration },
    animation: {
      kind: 'fade',
      from: opts.from ?? 0,
      to: opts.to ?? 1,
      easing: 'linear',
    },
    autoplay: true,
  } as Animation;
}

function textEl(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'el',
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    text: 'hi',
    align: 'left',
    ...overrides,
  } as TextElement;
}

function slideWith(...elements: TextElement[]): Slide {
  return { id: 'slide', elements } as Slide;
}

describe('applyAnimationsAtFrame — fade', () => {
  it('pre-window: opacity matches the animation `from` value', () => {
    const el = textEl({ animations: [fade({ start: 10, duration: 20, from: 0, to: 1 })] });
    const applied = applyAnimationsAtFrame(el, 5, 30);
    expect(applied.transform.opacity).toBe(0);
  });

  it('mid-window (linear): opacity is the midpoint', () => {
    const el = textEl({ animations: [fade({ start: 10, duration: 20, from: 0, to: 1 })] });
    const applied = applyAnimationsAtFrame(el, 20, 30);
    expect(applied.transform.opacity).toBeCloseTo(0.5, 5);
  });

  it('post-window: opacity clamps at the `to` value', () => {
    const el = textEl({ animations: [fade({ start: 10, duration: 20, from: 0, to: 1 })] });
    const applied = applyAnimationsAtFrame(el, 100, 30);
    expect(applied.transform.opacity).toBe(1);
  });

  it('returns the same element reference when there are no animations', () => {
    const el = textEl();
    expect(applyAnimationsAtFrame(el, 10, 30)).toBe(el);
  });

  it('non-absolute timing passes through unchanged', () => {
    const el = textEl({
      animations: [
        {
          id: 'a',
          timing: { kind: 'relative', offsetFrames: 0, durationFrames: 10 },
          animation: { kind: 'fade', from: 0, to: 1, easing: 'linear' },
          autoplay: true,
        } as Animation,
      ],
    });
    const applied = applyAnimationsAtFrame(el, 5, 30);
    expect(applied.transform.opacity).toBe(1);
  });
});

describe('<SlidePlayer> — scrub mode', () => {
  it('renders at the supplied currentFrame', () => {
    const el = textEl({ animations: [fade({ start: 0, duration: 30, from: 0, to: 1 })] });
    render(
      <SlidePlayer
        slide={slideWith(el)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={60}
        currentFrame={15}
      />,
    );
    const player = screen.getByTestId('slide-player');
    expect(player.getAttribute('data-current-frame')).toBe('15');
    const elNode = screen.getByTestId('element-el');
    expect(elNode.style.opacity).toBe('0.5');
  });

  it('updates when the scrubbed frame changes', () => {
    const el = textEl({ animations: [fade({ start: 0, duration: 30, from: 0, to: 1 })] });
    const { rerender } = render(
      <SlidePlayer
        slide={slideWith(el)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={60}
        currentFrame={0}
      />,
    );
    expect(screen.getByTestId('element-el').style.opacity).toBe('0');
    rerender(
      <SlidePlayer
        slide={slideWith(el)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={60}
        currentFrame={30}
      />,
    );
    expect(screen.getByTestId('element-el').style.opacity).toBe('1');
  });

  it('reports scrubbed frame via onFrameChange', () => {
    const el = textEl();
    const onFrameChange = vi.fn();
    render(
      <SlidePlayer
        slide={slideWith(el)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={60}
        currentFrame={42}
        onFrameChange={onFrameChange}
      />,
    );
    expect(onFrameChange).toHaveBeenLastCalledWith(42);
  });
});

describe('<SlidePlayer> — playback via rAF', () => {
  // Stub rAF/cAF on the global so the player never schedules real
  // animation frames. Each test pulls callbacks from the queue and
  // invokes them explicitly with synthetic timestamps.
  type QueueEntry = { id: number; cb: FrameRequestCallback };
  let queue: QueueEntry[];
  let nextId: number;

  beforeEach(() => {
    queue = [];
    nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = nextId++;
      queue.push({ id, cb });
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      queue = queue.filter((e) => e.id !== id);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('schedules a rAF step when playing=true and stops when unmounted', () => {
    const el = textEl();
    const { unmount } = render(
      <SlidePlayer
        slide={slideWith(el)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={60}
        playing
      />,
    );
    expect(queue.length).toBeGreaterThanOrEqual(1);
    unmount();
    // The unmount clears the ref-scoped `cancelled` flag and removes the
    // pending rAF. Subsequent queue reads do not advance the component.
  });

  it('advances the rendered frame when the rAF step fires', () => {
    const el = textEl({ animations: [fade({ start: 0, duration: 30, from: 0, to: 1 })] });
    render(
      <SlidePlayer
        slide={slideWith(el)}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={30}
        playing
      />,
    );
    // First rAF arms the clock (`lastMs = 0`); no frame advance yet.
    act(() => {
      const first = queue.shift();
      if (first) first.cb(0);
    });
    // Next rAF at t=500ms → 15 frames at 30fps.
    act(() => {
      const next = queue.shift();
      if (next) next.cb(500);
    });
    const player = screen.getByTestId('slide-player');
    const f = Number.parseInt(player.getAttribute('data-current-frame') ?? '', 10);
    expect(f).toBeGreaterThanOrEqual(14);
    expect(f).toBeLessThanOrEqual(16);
  });
});
