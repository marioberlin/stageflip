// packages/editor-shell/src/timeline/use-scrubber.ts
// Scrubber state + click/drag-to-seek handler (T-181c).
//
// The scrubber owns:
//   - `currentFrame` — the playhead position, clamped to
//     `[0, durationFrames]`.
//   - `dragging` — whether a pointer drag is in progress.
//   - A single `onPointerDown` handler the caller attaches to the
//     scrubbable surface (usually the ruler or the whole panel).
//     The handler itself wires up `pointermove` + `pointerup` against
//     the document so dragging follows the cursor even when it
//     leaves the original element.
//
// The hook is pointer-only (no mouse/touch duplication) since every
// browser that matters supports pointer events. Tests drive it via
// synthesized PointerEvents through @testing-library.

'use client';

import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';

import { type TimelineScale, pxToFrame, snapFrame } from './math';

export interface UseScrubberOptions {
  readonly scale: TimelineScale;
  readonly durationFrames: number;
  /** Initial playhead frame. Defaults to 0. */
  readonly initialFrame?: number;
  /** Snap step in frames. 0 or 1 disables snap. Defaults to 0. */
  readonly snapFrames?: number;
  /** Notified on every frame change (seek, drag-update, commit). */
  readonly onChange?: (frame: number) => void;
}

export interface UseScrubberResult {
  readonly currentFrame: number;
  readonly dragging: boolean;
  /** Imperative seek. Clamps + snaps + fires `onChange`. */
  readonly setCurrentFrame: (next: number) => void;
  /** Attach to the scrubbable surface. Reads pointer.clientX relative to the surface. */
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

function clampFrame(frame: number, durationFrames: number): number {
  if (!Number.isFinite(frame)) return 0;
  if (frame < 0) return 0;
  if (frame > durationFrames) return durationFrames;
  return frame;
}

export function useScrubber(options: UseScrubberOptions): UseScrubberResult {
  const { scale, durationFrames, initialFrame = 0, snapFrames = 0, onChange } = options;

  const [currentFrame, setCurrentFrameState] = useState<number>(() =>
    clampFrame(initialFrame, durationFrames),
  );
  const [dragging, setDragging] = useState<boolean>(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const apply = useCallback(
    (rawFrame: number) => {
      const snapped = snapFrame(rawFrame, snapFrames);
      const clamped = clampFrame(snapped, durationFrames);
      setCurrentFrameState(clamped);
      onChangeRef.current?.(clamped);
    },
    [snapFrames, durationFrames],
  );

  const setCurrentFrame = useCallback((next: number) => apply(next), [apply]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return; // left-button only
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const frameAtX = (clientX: number) => pxToFrame(clientX - rect.left, scale);

      // seek immediately on pointerdown
      apply(frameAtX(event.clientX));
      setDragging(true);

      const onMove = (e: PointerEvent) => apply(frameAtX(e.clientX));
      const onUp = () => {
        setDragging(false);
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        try {
          target.releasePointerCapture(event.pointerId);
        } catch {
          // releasing an already-released capture throws in some impls; ignore.
        }
      };

      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // happy-dom doesn't support setPointerCapture; tests still work via listeners.
      }
      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    },
    [apply, scale],
  );

  return { currentFrame, dragging, setCurrentFrame, onPointerDown };
}
