// packages/frame-runtime/src/media-host.tsx
// <FrameVideo> / <FrameAudio> / <FrameImage> — thin wrappers around the
// native <video> / <audio> / <img> elements so clips can render media
// without importing Remotion. Video and audio wrappers delegate
// playback-clock sync to useMediaSync; the image wrapper is a
// window-gated mount (the <img> element has no currentTime and animated
// GIFs play at browser pace — frame-accurate seek would require a
// decode pipeline that belongs in the bake runtime, not here).

import { type ComponentPropsWithoutRef, type ReactElement, createElement, useRef } from 'react';

import { useCurrentFrame, useVideoConfig } from './frame-context.js';
import { type UseMediaSyncOptions, useMediaSync } from './use-media-sync.js';

export interface FrameMediaWindowProps {
  /** Composition-time offset at which this media becomes active. Default 0. */
  offsetMs?: number;
  /** Length of the active window in composition time. `undefined` means "until composition ends". */
  durationMs?: number;
}

export type FrameVideoProps = FrameMediaWindowProps & ComponentPropsWithoutRef<'video'>;
export type FrameAudioProps = FrameMediaWindowProps & ComponentPropsWithoutRef<'audio'>;
export type FrameImageProps = FrameMediaWindowProps & ComponentPropsWithoutRef<'img'>;

// exactOptionalPropertyTypes: never assign undefined to an optional key.
// Build the options object conditionally so absent props stay absent rather
// than being written as { offsetMs: undefined }.
function buildSyncOptions(
  offsetMs: number | undefined,
  durationMs: number | undefined,
): UseMediaSyncOptions {
  const opts: UseMediaSyncOptions = {};
  if (offsetMs !== undefined) opts.offsetMs = offsetMs;
  if (durationMs !== undefined) opts.durationMs = durationMs;
  return opts;
}

/**
 * `<video>` element whose `.currentTime` is driven by the FrameClock via
 * `useMediaSync`. Outside the active window `[offsetMs, offsetMs +
 * durationMs)` the hook pauses the element; the DOM node stays mounted so
 * the ref and network-level preload state remain stable across the
 * transition. `offsetMs` / `durationMs` are not forwarded to the DOM; all
 * other props pass through to `<video>`.
 */
export function FrameVideo({ offsetMs, durationMs, ...rest }: FrameVideoProps): ReactElement {
  const ref = useRef<HTMLVideoElement>(null);
  useMediaSync(ref, buildSyncOptions(offsetMs, durationMs));
  return createElement('video', { ref, ...rest });
}

/**
 * `<audio>` counterpart to `FrameVideo`. Same sync + prop-passthrough
 * contract. Typical use: voiceover / narration tracks timed against the
 * composition clock.
 */
export function FrameAudio({ offsetMs, durationMs, ...rest }: FrameAudioProps): ReactElement {
  const ref = useRef<HTMLAudioElement>(null);
  useMediaSync(ref, buildSyncOptions(offsetMs, durationMs));
  return createElement('audio', { ref, ...rest });
}

/**
 * `<img>` element gated by a composition-time active window. Mounts the
 * image iff `currentMs ∈ [offsetMs, offsetMs + durationMs)`; outside the
 * window the component returns `null`. No playback sync — still images
 * have no `.currentTime`, and animated GIFs advance at browser pace (the
 * browser's own decode loop is wall-clock-driven, not frame-driven).
 * `offsetMs` / `durationMs` are not forwarded to the DOM.
 */
export function FrameImage({
  offsetMs,
  durationMs,
  ...rest
}: FrameImageProps): ReactElement | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const startMs = offsetMs ?? 0;
  const endMs = durationMs === undefined ? Number.POSITIVE_INFINITY : startMs + durationMs;
  if (currentMs < startMs || currentMs >= endMs) return null;
  return createElement('img', rest);
}
