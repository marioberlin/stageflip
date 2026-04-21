// packages/renderer-cdp/src/frame-sink.ts
// FrameSink is the output seam for the export dispatcher. Frames emitted by
// the live-tier adapter flow through a sink — in-memory for tests, disk for
// dev harnesses, FFmpeg-pipe for real MP4/MOV/WebM output (wired in T-085).
//
// The interface is minimal on purpose: one call per frame, one close. The
// dispatcher never peeks inside the sink; downstream stages consume whatever
// the sink kept (frame array, streaming FFmpeg stdin, etc.).

/**
 * Stream of captured frames. Implementations are expected to be single-use:
 * once `close` resolves, further `onFrame` calls must reject.
 */
export interface FrameSink {
  /**
   * Accept one captured frame. Called in ascending order of `frame`. Must not
   * mutate `buffer`; implementations that hold on to the buffer should clone
   * or reference-count.
   */
  onFrame(frame: number, buffer: Uint8Array): Promise<void>;
  /**
   * Flush any pending work and release resources. Idempotent — the
   * dispatcher may call this in a finally block even if onFrame already
   * threw.
   */
  close(): Promise<void>;
}

/**
 * Test / inspection sink that keeps every captured frame in memory in
 * insertion order. Not suitable for long exports (buffers accumulate) — use
 * a disk or stream sink in production.
 */
export class InMemoryFrameSink implements FrameSink {
  public readonly frames: Array<{ frame: number; buffer: Uint8Array }> = [];
  private closed = false;

  get isClosed(): boolean {
    return this.closed;
  }

  async onFrame(frame: number, buffer: Uint8Array): Promise<void> {
    if (this.closed) {
      throw new Error('InMemoryFrameSink: onFrame called after close');
    }
    this.frames.push({ frame, buffer });
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
