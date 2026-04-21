// packages/runtimes/three/src/host.tsx
// Private React host for a single three.js clip instance. Calls the clip's
// `setup` once on mount, then its `render` callback every frame. The runtime
// does not know about THREE types — authors own their scene / camera /
// renderer lifecycle inside the callbacks.
//
// Deterministic render: the host never starts a THREE animation loop
// (`renderer.setAnimationLoop`) and never uses requestAnimationFrame. The
// render callback runs synchronously in a useEffect per frame change.

import { type ReactElement, useEffect, useRef } from 'react';

import type { ThreeClipHandle, ThreeClipSetup } from './types.js';

export interface ThreeClipHostProps<P> {
  /** Clip's setup callback — constructs scene, appends renderer.domElement. */
  setup: ThreeClipSetup<P>;
  /** Canvas width in CSS pixels. */
  width: number;
  /** Canvas height in CSS pixels. */
  height: number;
  /** Clip props forwarded to setup + render. */
  props: P;
  /** Clip-local frame (`parentFrame - clipFrom`). Drives the render. */
  localFrame: number;
  /** Composition fps — used to derive timeSec. */
  fps: number;
  /** Clip duration in frames — used to derive progress. May be Infinity. */
  clipDurationInFrames: number;
}

export function ThreeClipHost<P>({
  setup,
  width,
  height,
  props,
  localFrame,
  fps,
  clipDurationInFrames,
}: ThreeClipHostProps<P>): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ThreeClipHandle<P> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let handle: ThreeClipHandle<P> | null = null;
    try {
      handle = setup({ container, width, height, props });
    } catch {
      // WebGL unavailable (happy-dom, disabled by user, etc.). Real browsers
      // always succeed; tests route through the factory-less infrastructure
      // suite. Silent bail keeps the test env clean.
      return;
    }
    handleRef.current = handle;
    return () => {
      handle?.dispose?.();
      handleRef.current = null;
    };
    // setup + props identity changes re-run the lifecycle on purpose.
  }, [setup, width, height, props]);

  useEffect(() => {
    const handle = handleRef.current;
    if (handle === null) return;
    const progress =
      clipDurationInFrames === Number.POSITIVE_INFINITY ? 0 : localFrame / clipDurationInFrames;
    const timeSec = localFrame / fps;
    handle.render({
      progress,
      timeSec,
      frame: localFrame,
      fps,
      props,
    });
  }, [localFrame, fps, clipDurationInFrames, props]);

  return (
    <div
      ref={containerRef}
      data-stageflip-three="true"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  );
}
