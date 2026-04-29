// packages/runtimes/interactive/src/frame-source.ts
// `FrameSource` — the interactive-tier abstraction for "what frame is it?".
// Per T-383 D-T383-6, frame-driven families (`shader`, `three-scene`) consume
// a frame source supplied via `MountContext.frameSource`; event-driven
// families (`ai-chat`, `voice`, `web-embed`, etc.) ignore it. Implementations
// ship in `frame-source-raf.ts` (browser live-preview) and
// `frame-source-record.ts` (record mode for renderer-cdp + parity tests).
//
// This file lives one directory above `clips/shader/**` and is therefore NOT
// subject to T-309's shader sub-rule path-based determinism check — RAF lives
// here intentionally so the rule can rule on uniform-updaters without
// shadowing the rAF shim itself.

/**
 * The frame-tick contract supplied to a frame-driven `ClipFactory`. The
 * factory subscribes at mount entry and unsubscribes at dispose. `current()`
 * is the synchronous read used for first paint — without it, the factory
 * would have to wait one rAF tick to render its initial frame, which would
 * defeat the deterministic record-mode path.
 */
export interface FrameSource {
  /**
   * Subscribe to frame ticks. The handler is invoked once per frame
   * advance with the new frame number. Returns an unsubscribe callback;
   * the factory MUST call it on dispose to avoid leaked handlers.
   *
   * Implementations must be idempotent on unsubscribe — calling twice is
   * a no-op. They MUST also cope with subscribing during a tick (i.e.,
   * adding a handler from within another handler's callback) without
   * crashing; the new handler should observe the next tick.
   */
  subscribe(handler: (frame: number) => void): () => void;
  /**
   * Synchronous current frame for first paint. Frame-driven factories
   * use this to compute initial uniforms before the first tick arrives.
   */
  current(): number;
}

/**
 * Thrown by the `ShaderClip` factory (and future frame-driven family
 * factories) when `MountContext.frameSource` is `undefined`. Frame-driven
 * families cannot operate without a tick source; failing fast at mount
 * surfaces the integration error to the caller (the editor, the renderer,
 * the live-preview surface) rather than producing a frozen first paint.
 *
 * The error message references ADR-005 §D2 — the convergence guarantee
 * that the frame source enables — so reviewers can trace back to the
 * architectural decision.
 */
export class MissingFrameSourceError extends Error {
  constructor(public readonly family: string) {
    super(
      `Interactive clip family '${family}' requires MountContext.frameSource. Pass a RAFFrameSource (live preview) or RecordModeFrameSource (record mode). See ADR-005 §D2.`,
    );
    this.name = 'MissingFrameSourceError';
  }
}
