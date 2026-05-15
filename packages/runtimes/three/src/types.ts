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
 *
 * `getMemoryEstimateMb` — T-403 R-7 opt-in DoS protection. Authors who
 * want their clip to be protected against unbounded scene-graph growth
 * return a function that estimates the current memory usage of their
 * scene in megabytes (typically: sum of `BufferGeometry.attributes.*.array.byteLength`
 * plus texture byte-lengths plus material/cached resources). When the
 * factory-supplied `memoryBudgetMb` is exceeded by the returned estimate,
 * the interactive-tier wrapper tears the mount down and routes to
 * `staticFallback`. The estimate is opt-in by design: `@stageflip/runtimes-three`
 * does NOT depend on `three` and cannot walk the author's scene; the
 * author is the only party that can produce a reliable estimate. When
 * the callback is absent, the budget is informational only and no kill
 * fires. See `docs/security-review-track-a.md` §5 R-7.
 */
export interface ThreeClipHandle<P = unknown> {
  render(args: ThreeClipRenderArgs<P>): void;
  dispose?(): void;
  getMemoryEstimateMb?(): number;
}

/**
 * Minimal seeded-PRNG shape supplied to `setup` by the interactive-tier
 * frontier wrapper (T-384 D-T384-5, ADR-005 §D2). The §3 path
 * (`createThreeRuntime` / `defineThreeClip`) does not pass `prng` — the
 * field is therefore optional. Authors targeting BOTH paths read with
 * `args.prng?.random()` and fall back to a frame-derived deterministic
 * value when the §3 host is the caller.
 */
export interface SetupPRNG {
  /** Returns a deterministic float in `[0, 1)`. */
  random(): number;
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
  /**
   * Optional seeded PRNG supplied by the interactive-tier frontier wrapper
   * (T-384). The §3 `defineThreeClip` host does not pass this; the
   * frontier-tier `ThreeSceneClip` factory always does. Authors targeting
   * the frontier tier MUST use `prng.random()` rather than `Math.random()`
   * — `Math.random()` is forbidden inside `clips/three-scene/**` by
   * T-309's tightened sub-rule.
   */
  prng?: SetupPRNG;
}

export type ThreeClipSetup<P = unknown> = (args: ThreeClipSetupArgs<P>) => ThreeClipHandle<P>;
