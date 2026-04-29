// packages/runtimes/three/src/host.tsx
// Private React host for a single three.js clip instance. Calls the clip's
// `setup` once on mount, then its `render` callback every frame. The runtime
// does not know about THREE types — authors own their scene / camera /
// renderer lifecycle inside the callbacks.
//
// Deterministic render: the host never starts a THREE animation loop
// (`renderer.setAnimationLoop`) and never uses requestAnimationFrame. The
// render callback runs synchronously in a useEffect per frame change.
//
// Setup-effect dependency posture (T-384 D-T384-1): the setup effect re-
// runs only when `setup`, `width`, `height`, or `prng` change — NOT when
// `props` change. Prop updates flow through the per-frame render callback
// where they belong. Re-running setup on every prop tick would tear down
// + rebuild the scene, defeating the interactive tier's `updateProps`
// contract (T-384 AC #11) and torching three.js's setup cost on every
// frame the editor scrubbed across. The §3 path's tests never relied on
// setup-on-prop-change; this is a conservative tightening.

import { type ReactElement, useEffect, useRef } from 'react';

import type { SetupPRNG, ThreeClipHandle, ThreeClipSetup } from './types.js';

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
  /**
   * Optional seeded PRNG forwarded to `setup` by the interactive-tier
   * frontier-clip wrapper (T-384). The §3 host wiring never sets this; the
   * `ThreeSceneClip` factory always does.
   */
  prng?: SetupPRNG;
}

export function ThreeClipHost<P>({
  setup,
  width,
  height,
  props,
  localFrame,
  fps,
  clipDurationInFrames,
  prng,
}: ThreeClipHostProps<P>): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ThreeClipHandle<P> | null>(null);

  // Capture the latest `props` in a ref so the setup effect can read the
  // initial values without listing `props` as a dep — which would re-run
  // setup on every prop change and tear down the scene.
  const propsRef = useRef<P>(props);
  propsRef.current = props;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    let handle: ThreeClipHandle<P> | null = null;
    try {
      const setupArgs = {
        container,
        width,
        height,
        props: propsRef.current,
      } as Parameters<ThreeClipSetup<P>>[0];
      if (prng !== undefined) {
        setupArgs.prng = prng;
      }
      handle = setup(setupArgs);
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
    // Setup deps deliberately exclude `props`: prop updates flow through
    // the render-effect below, NOT through a full setup teardown. See file
    // header.
  }, [setup, width, height, prng]);

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
