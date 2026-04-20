// packages/frame-runtime/src/use-media-sync.ts
// useMediaSync — imperatively drive an HTMLMediaElement's `.currentTime` to
// match the FrameClock during scrub, and manage its play/pause lifecycle
// based on whether the current frame lies inside `[offsetMs, offsetMs +
// durationMs)`. Writes are elided while drift is within half a frame so
// smooth natural playback is not interrupted by redundant seeks.
//
// Usage:
//   const ref = useRef<HTMLVideoElement>(null);
//   useMediaSync(ref, { offsetMs: 2000, durationMs: 5000 });
//   return <video ref={ref} src="/hero.mp4" />;

import { type RefObject, useEffect } from 'react';

import { useCurrentFrame, useVideoConfig } from './frame-context.js';

export interface UseMediaSyncOptions {
  /** Composition-time offset at which this media becomes active. Default 0. */
  offsetMs?: number;
  /** Length of the active window in composition time. `undefined` means "until composition ends". */
  durationMs?: number;
}

/**
 * Sync an `<video>` / `<audio>` element's `.currentTime` to the FrameClock.
 *
 * - Inside the active window: seeks to `(currentMs - offsetMs) / 1000` in
 *   media-local time when drift exceeds half a frame; ensures the media is
 *   playing.
 * - Outside the active window: pauses the media. No seek.
 *
 * Silent to `play()` rejections (autoplay policy, revoked permissions).
 *
 * @param ref A ref to an `HTMLVideoElement` or `HTMLAudioElement`. `null` is safe.
 * @param options Active-window bounds in composition time.
 */
export function useMediaSync(
  ref: RefObject<HTMLVideoElement | HTMLAudioElement | null>,
  options: UseMediaSyncOptions = {},
): void {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const offsetMs = options.offsetMs ?? 0;
  const durationMs = options.durationMs;

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;

    const currentMs = (frame / fps) * 1000;
    const startMs = offsetMs;
    const endMs = durationMs === undefined ? Number.POSITIVE_INFINITY : offsetMs + durationMs;
    const inWindow = currentMs >= startMs && currentMs < endMs;

    if (!inWindow) {
      if (!el.paused) el.pause();
      return;
    }

    const targetSec = (currentMs - startMs) / 1000;
    const halfFrameSec = 0.5 / fps;
    if (Math.abs(el.currentTime - targetSec) > halfFrameSec) {
      el.currentTime = targetSec;
    }

    if (el.paused) {
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          /* Autoplay policies and revoked permissions are consumer concerns. */
        });
      }
    }
  }, [frame, fps, offsetMs, durationMs, ref]);
}
