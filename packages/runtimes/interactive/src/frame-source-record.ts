// packages/runtimes/interactive/src/frame-source-record.ts
// `RecordModeFrameSource` — externally-driven frame source per T-383 D-T383-6.
// Used by `renderer-cdp` in record mode and by parity / convergence tests.
// The caller advances the clock with `advance(N)`; subscribers receive each
// emitted frame in order. Deterministic by construction — no rAF, no timers,
// no wall-clock.

import type { FrameSource } from './frame-source.js';

/**
 * Frame source whose advancement is caller-driven. The producer (record-mode
 * driver, parity test) calls `advance(N)` to emit frame increments;
 * consumers (factories, host components) `subscribe` to receive them.
 *
 * Bit-exact convergence with `RAFFrameSource` is not the goal — the two are
 * deliberately distinct timebases. What MUST hold (per T-383 AC #18) is that
 * given the same `(frame, fragmentShader, props)` triple, the rendered
 * pixels are identical regardless of which source produced the frame
 * number. This is the convergence-by-construction guarantee.
 */
export class RecordModeFrameSource implements FrameSource {
  private frame: number;
  private readonly handlers = new Set<(frame: number) => void>();

  constructor(initialFrame = 0) {
    this.frame = initialFrame;
  }

  current(): number {
    return this.frame;
  }

  subscribe(handler: (frame: number) => void): () => void {
    this.handlers.add(handler);
    let unsubscribed = false;
    return (): void => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.handlers.delete(handler);
    };
  }

  /**
   * Advance the clock by `count` frames, emitting each intermediate frame
   * to subscribers in order. Default `count` is 1 (single-step). `count`
   * must be a non-negative integer; passing 0 is a no-op (useful for
   * "tick to current frame" idiom).
   */
  advance(count = 1): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(
        `RecordModeFrameSource.advance: count must be a non-negative integer (got ${count})`,
      );
    }
    for (let i = 0; i < count; i += 1) {
      this.frame += 1;
      // Snapshot to tolerate subscribe / unsubscribe inside a callback.
      const snapshot = Array.from(this.handlers);
      for (const handler of snapshot) {
        handler(this.frame);
      }
    }
  }

  /**
   * Reset the clock to a specific frame WITHOUT emitting. Used by tests to
   * jump to a baseline before a sequence of `advance()` calls. Production
   * code should not call this — the renderer drives the clock monotonically.
   */
  reset(frame = 0): void {
    this.frame = frame;
  }

  /** Number of currently-subscribed handlers. Test/diagnostic surface. */
  subscriberCount(): number {
    return this.handlers.size;
  }
}
