// packages/runtimes/lottie/src/host.tsx
// Private React host for a single Lottie clip instance. lottie-web is
// loaded with `autoplay: false` and seeked via `goToAndStop(ms, false)`
// every render. No ticker, no play — same determinism posture as the
// gsap runtime.

import { type ReactElement, useEffect, useRef } from 'react';

import type { LottieAnimationItem, LottiePlayer } from './types.js';

export interface LottieClipHostProps {
  /** Raw Lottie JSON — typically imported at module scope. */
  animationData: unknown;
  /** Clip-local frame (`parentFrame - clipFrom`). */
  localFrame: number;
  /** Composition fps. */
  fps: number;
  /** Lottie player. Pass a real `import('lottie-web').default` or a test stub. */
  lottiePlayer: LottiePlayer;
}

/**
 * Mounts an SVG-renderer Lottie animation into a container div, then drives
 * it via time-based `goToAndStop`. The composition's fps + the clip's local
 * frame count are converted to milliseconds; Lottie resolves against the
 * animation's own internal `fr` internally.
 */
export function LottieClipHost({
  animationData,
  localFrame,
  fps,
  lottiePlayer,
}: LottieClipHostProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<LottieAnimationItem | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const anim = lottiePlayer.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      animationData,
    });
    animRef.current = anim;
    return () => {
      anim.destroy();
      animRef.current = null;
    };
  }, [animationData, lottiePlayer]);

  useEffect(() => {
    const anim = animRef.current;
    if (anim === null) return;
    const ms = (localFrame / fps) * 1000;
    // isFrame=false → value is in milliseconds. Keeps seek
    // independent of the Lottie animation's internal frame rate.
    anim.goToAndStop(ms, false);
  }, [localFrame, fps]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
