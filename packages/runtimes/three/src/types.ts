// packages/runtimes/three/src/types.ts
// Public types for @stageflip/runtimes-three. Deliberately THREE-agnostic:
// the runtime does not import from `three`. Clip authors bring their own
// THREE instance (and transitive import), construct scene/camera/renderer
// inside `setup`, and return a pair of callbacks. Keeps the host thin and
// makes the package usable with alternative three-compatible libraries
// without modification.

/** Per-frame inputs the host feeds to a clip's render callback. */
export interface ThreeClipRenderArgs<P = unknown> {
  /** Clip-local progress 0..1 (`localFrame / clipDurationInFrames`). */
  progress: number;
  /** Clip-local time in seconds (`localFrame / fps`). */
  timeSec: number;
  /** Clip-local frame number. */
  frame: number;
  /** Composition fps. */
  fps: number;
  /** Clip props. */
  props: P;
}

/**
 * Object returned by a clip's `setup`. The host calls `render` every frame
 * and `dispose` on unmount. Authors typically close over their scene /
 * camera / renderer / meshes inside these callbacks.
 */
export interface ThreeClipHandle<P = unknown> {
  render(args: ThreeClipRenderArgs<P>): void;
  dispose?(): void;
}

/** Arguments passed to a clip's `setup` callback at mount time. */
export interface ThreeClipSetupArgs<P = unknown> {
  /** Container div. Authors append `renderer.domElement` here. */
  container: HTMLElement;
  /** Canvas width in CSS pixels. */
  width: number;
  /** Canvas height in CSS pixels. */
  height: number;
  /** Clip props. */
  props: P;
}

export type ThreeClipSetup<P = unknown> = (args: ThreeClipSetupArgs<P>) => ThreeClipHandle<P>;
