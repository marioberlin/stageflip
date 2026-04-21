// packages/runtimes/gsap/src/host.tsx
// Private React host that owns the GSAP timeline for a single clip instance.
// Creates the timeline paused on mount, lets the clip author configure it
// via the `build` callback, and seeks to the clip-local time every frame.
//
// The timeline is NEVER played — we drive it purely via seek() so that
// GSAP's internal ticker never advances our animations. This is the
// determinism contract for the gsap runtime.

import { gsap } from 'gsap';
import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';

export type GsapTimelineBuild<P> = (
  props: P,
  timeline: gsap.core.Timeline,
  container: HTMLElement,
) => void;

export interface GsapClipHostProps<P> {
  /** One-shot timeline builder called on mount with the paused timeline. */
  build: GsapTimelineBuild<P>;
  /** Clip props forwarded to build + render. */
  props: P;
  /** Render the clip's DOM — the `container` div given to build is a wrapper of this. */
  render(props: P): ReactNode;
  /** Clip-local frame (`parentFrame - clipFrom`). Drives the timeline seek. */
  localFrame: number;
  /** Composition fps — used to convert localFrame to seconds. */
  fps: number;
}

/**
 * Mounts the clip's DOM inside a container div, creates a paused GSAP
 * timeline, hands both to the clip's `build` callback once, then seeks the
 * timeline to `localFrame / fps` on every render.
 */
export function GsapClipHost<P>({
  build,
  props,
  render,
  localFrame,
  fps,
}: GsapClipHostProps<P>): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const tl = gsap.timeline({ paused: true });
    build(props, tl, container);
    timelineRef.current = tl;
    return () => {
      tl.kill();
      timelineRef.current = null;
    };
    // The `build` + `props` identities are expected to be stable for a given
    // clip kind; re-running on change would re-configure the timeline. We
    // re-run deliberately on prop identity change.
  }, [build, props]);

  useEffect(() => {
    const tl = timelineRef.current;
    if (tl === null) return;
    const seconds = localFrame / fps;
    tl.seek(seconds, false);
  }, [localFrame, fps]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {render(props)}
    </div>
  );
}
