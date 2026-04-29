// packages/runtimes/interactive/src/frame-source-raf.ts
// `RAFFrameSource` — `requestAnimationFrame`-backed frame source for browser
// live-preview surfaces. Wraps the standard rAF cadence into a `FrameSource`
// per T-383 D-T383-6. The interactive-tier broad determinism exemption
// applies (ADR-003 §D5); rAF is permitted in this directory.
//
// Frame counter: integer, starts at 0, incremented once per rAF callback. The
// counter is internal — callers consume it via the `FrameSource.current()` /
// `subscribe(...)` contract.

import type { FrameSource } from './frame-source.js';

/**
 * Optional injected `requestAnimationFrame` / `cancelAnimationFrame` pair.
 * Tests pass a fake pair to drive ticks deterministically; production
 * defaults to the browser's globals.
 */
export interface RAFFrameSourceOptions {
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  /** Initial frame value; defaults to 0. */
  initialFrame?: number;
}

/**
 * Browser-live-preview frame source. One instance per preview surface;
 * subscribers fan out to the same internal counter. Disposing the source
 * (`dispose()`) cancels the in-flight rAF callback and stops the loop.
 */
export class RAFFrameSource implements FrameSource {
  private frame: number;
  private readonly handlers = new Set<(frame: number) => void>();
  private readonly raf: (cb: FrameRequestCallback) => number;
  private readonly caf: (handle: number) => void;
  private rafHandle: number | null = null;
  private running = false;

  constructor(options: RAFFrameSourceOptions = {}) {
    this.frame = options.initialFrame ?? 0;
    this.raf =
      options.requestAnimationFrame ??
      ((cb) => {
        if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
        // Server-side / test envs without rAF — fall back to setTimeout(0).
        // The interactive tier is exempt from §3 determinism (ADR-003 §D5).
        return setTimeout(() => cb(0), 16) as unknown as number;
      });
    this.caf =
      options.cancelAnimationFrame ??
      ((handle) => {
        if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame(handle);
        clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
      });
  }

  current(): number {
    return this.frame;
  }

  subscribe(handler: (frame: number) => void): () => void {
    this.handlers.add(handler);
    if (!this.running) {
      this.running = true;
      this.scheduleNext();
    }
    let unsubscribed = false;
    return (): void => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.handlers.delete(handler);
      if (this.handlers.size === 0) {
        this.stop();
      }
    };
  }

  /**
   * Stop the rAF loop. Idempotent. Call once the last subscriber has
   * unsubscribed (the source itself triggers this) or on owner-driven
   * teardown (mount-harness dispose path).
   */
  dispose(): void {
    this.handlers.clear();
    this.stop();
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.rafHandle = this.raf(() => {
      if (!this.running) return;
      this.frame += 1;
      // Snapshot handlers to tolerate subscribe / unsubscribe inside a callback.
      const snapshot = Array.from(this.handlers);
      for (const handler of snapshot) {
        handler(this.frame);
      }
      this.scheduleNext();
    });
  }

  private stop(): void {
    this.running = false;
    if (this.rafHandle !== null) {
      this.caf(this.rafHandle);
      this.rafHandle = null;
    }
  }
}
