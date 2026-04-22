// apps/stageflip-slide/src/components/canvas/slide-player.tsx
// Frame-driven slide preview player (T-123d).

'use client';

import {
  EASINGS,
  type EasingFn,
  FrameProvider,
  type NamedEasing,
  type VideoConfig,
  interpolate,
  linear,
} from '@stageflip/frame-runtime';
import type { Animation, Element, Slide, Transform } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ElementView } from './element-view';

/**
 * In-canvas preview player. Drives a `<FrameProvider>` over the slide's
 * element tree and renders per-frame transforms through `<ElementView>`.
 * Playback uses `requestAnimationFrame`; paused/scrubbed mode renders
 * the passed `currentFrame` directly.
 *
 * Scope
 * -----
 * Replaces the Remotion-based `SingleSlidePreview` / `PlayerPreview`
 * from `reference/slidemotion/`. This iteration supports:
 *   - `absolute` timing primitives (B1)
 *   - `fade` animations with every named easing the runtime ships
 *   - other animation kinds / timings render unmodified (placeholder)
 *
 * Per-element animation arrays iterate in order; later animations
 * override earlier ones on the same property (opacity for fade).
 * Slide / scale / rotate / color / keyframed / runtime animations
 * arrive with later tasks.
 *
 * Zero Remotion imports per CLAUDE.md §3 — animation math runs through
 * `@stageflip/frame-runtime` (`interpolate`, `NAMED_EASINGS`).
 */

export interface SlidePlayerProps {
  slide: Slide;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Frame to render when not playing. Default 0. */
  currentFrame?: number;
  /** When true, drive the frame counter via `requestAnimationFrame`. */
  playing?: boolean;
  /** Called whenever the rendered frame changes (scrub or playback). */
  onFrameChange?: (frame: number) => void;
}

export function SlidePlayer({
  slide,
  width,
  height,
  fps,
  durationInFrames,
  currentFrame = 0,
  playing = false,
  onFrameChange,
}: SlidePlayerProps): ReactElement {
  const frameRef = useRef<number>(currentFrame);
  // A mirror `useState` triggers re-renders on frame change. We keep
  // the authoritative value in the ref so inline rAF steps read the
  // latest without stale-closure issues.
  const [, setTick] = useState<number>(0);

  useEffect(() => {
    if (playing) return;
    frameRef.current = currentFrame;
    onFrameChange?.(currentFrame);
    setTick((t) => (t + 1) & 0xfffffff);
  }, [currentFrame, onFrameChange, playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastMs: number | null = null;
    let cancelled = false;
    const step = (nowMs: number): void => {
      if (cancelled) return;
      if (lastMs !== null) {
        const deltaMs = nowMs - lastMs;
        const deltaFrames = (deltaMs / 1000) * fps;
        const next = Math.min(durationInFrames - 1, frameRef.current + deltaFrames);
        frameRef.current = next;
        onFrameChange?.(next);
        setTick((t) => (t + 1) & 0xfffffff);
      }
      lastMs = nowMs;
      if (frameRef.current < durationInFrames - 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing, fps, durationInFrames, onFrameChange]);

  const config: VideoConfig = useMemo(
    () => ({ width, height, fps, durationInFrames }),
    [width, height, fps, durationInFrames],
  );

  const frame = Math.round(frameRef.current);

  return (
    <FrameProvider frame={frame} config={config}>
      <div data-testid="slide-player" data-current-frame={frame} style={playerStyle(width, height)}>
        {slide.elements.map((el) => (
          <AnimatedElementView key={el.id} element={el} frame={frame} fps={fps} />
        ))}
      </div>
    </FrameProvider>
  );
}

// ---------------------------------------------------------------------------
// Per-element animation application
// ---------------------------------------------------------------------------

function AnimatedElementView({
  element,
  frame,
  fps,
}: {
  element: Element;
  frame: number;
  fps: number;
}): ReactElement | null {
  const applied = useMemo(() => applyAnimationsAtFrame(element, frame, fps), [element, frame, fps]);
  return <ElementView element={applied} />;
}

/**
 * Returns the element with its `transform` replaced by the per-frame
 * snapshot. Only `absolute` timing + `fade` animations affect output
 * today; other animations pass through unchanged.
 */
export function applyAnimationsAtFrame(element: Element, frame: number, fps: number): Element {
  if (!('animations' in element) || element.animations.length === 0) return element;
  let transform: Transform = element.transform;
  for (const anim of element.animations) {
    transform = stepTransform(transform, anim, frame, fps);
  }
  if (transform === element.transform) return element;
  return { ...element, transform } as Element;
}

function stepTransform(
  transform: Transform,
  anim: Animation,
  frame: number,
  _fps: number,
): Transform {
  const window = resolveAbsoluteWindow(anim);
  if (!window) return transform;
  const progress = clamp((frame - window.startFrame) / window.durationFrames, 0, 1);
  const eased = easeProgress(progress, anim);
  const kind = anim.animation;
  if (kind.kind === 'fade') {
    const opacity = kind.from + (kind.to - kind.from) * eased;
    return { ...transform, opacity };
  }
  return transform;
}

function resolveAbsoluteWindow(
  anim: Animation,
): { startFrame: number; durationFrames: number } | null {
  const t = anim.timing;
  if (t.kind === 'absolute') {
    return { startFrame: t.startFrame, durationFrames: t.durationFrames };
  }
  return null;
}

function easeProgress(progress: number, anim: Animation): number {
  const kind = anim.animation;
  if (kind.kind !== 'fade') return progress;
  const easing = kind.easing;
  if (typeof easing === 'string') {
    const fn: EasingFn = EASINGS[easing as NamedEasing] ?? linear;
    return interpolate(progress, [0, 1], [0, 1], { easing: fn });
  }
  return progress;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function playerStyle(width: number, height: number): CSSProperties {
  return {
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
    background: '#0b1219',
  };
}
