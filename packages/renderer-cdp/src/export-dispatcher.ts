// packages/renderer-cdp/src/export-dispatcher.ts
// Top-level orchestrator of a CDP export run. Ties preflight, adapter, and
// sink together:
//
//   1. preflight(document) — pure analysis; refuses to proceed if it finds
//      unresolved clips, bake-tier work, or a malformed document.
//   2. LiveTierAdapter.mount(document) — opens the browser session and
//      mounts the composition.
//   3. For each frame in the render range: adapter.renderFrame → sink.onFrame.
//   4. finally: close adapter + sink (both are cleaned up even on error).
//
// The dispatcher owns the sink's close lifecycle once it's passed in — the
// caller hands ownership over, the dispatcher guarantees close is reached
// exactly once regardless of success or failure.
//
// Real Puppeteer-backed CdpSession implementation is T-085/T-090; disk-
// and FFmpeg-pipe sinks are T-085/T-088.

import type { RIRDocument } from '@stageflip/rir';

import { type CdpSession, LiveTierAdapter } from './adapter';
import type { FrameSink } from './frame-sink';
import { type PreflightBlocker, type PreflightReport, preflight } from './preflight';

export interface ExportOptions {
  readonly session: CdpSession;
  readonly sink: FrameSink;
  /**
   * Half-open `[start, end)` frame range to render. Defaults to the full
   * document: `{ start: 0, end: document.durationFrames }`.
   */
  readonly frameRange?: { readonly start: number; readonly end: number };
}

export interface ExportResult {
  readonly document: RIRDocument;
  readonly preflight: PreflightReport;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly framesRendered: number;
}

/**
 * Raised when `preflight(document)` returns blockers. Carries the full
 * blocker list so callers can surface a structured error.
 */
export class PreflightBlockedError extends Error {
  public readonly blockers: readonly PreflightBlocker[];

  constructor(blockers: readonly PreflightBlocker[]) {
    const summary = blockers.map((b) => `${b.kind}: ${b.message}`).join('; ');
    super(`preflight blocked: ${blockers.length} blocker(s) — ${summary}`);
    this.name = 'PreflightBlockedError';
    this.blockers = blockers;
  }
}

export async function exportDocument(
  document: RIRDocument,
  opts: ExportOptions,
): Promise<ExportResult> {
  const { session, sink } = opts;

  const report = preflight(document);
  if (report.blockers.length > 0) {
    // Ensure the sink is still closed — the caller relinquished ownership.
    await sink.close();
    throw new PreflightBlockedError(report.blockers);
  }

  const range = opts.frameRange ?? { start: 0, end: document.durationFrames };
  validateFrameRange(range, document.durationFrames);

  const adapter = new LiveTierAdapter(session);
  const mounted = await adapter.mount(document);

  let framesRendered = 0;
  try {
    for (let frame = range.start; frame < range.end; frame++) {
      const buffer = await adapter.renderFrame(mounted, frame);
      await sink.onFrame(frame, buffer);
      framesRendered++;
    }
  } finally {
    await adapter.close(mounted);
    await sink.close();
  }

  return {
    document,
    preflight: report,
    startFrame: range.start,
    endFrame: range.end,
    framesRendered,
  };
}

function validateFrameRange(
  range: { readonly start: number; readonly end: number },
  durationFrames: number,
): void {
  if (
    !Number.isInteger(range.start) ||
    !Number.isInteger(range.end) ||
    range.start < 0 ||
    range.end > durationFrames ||
    range.start >= range.end
  ) {
    throw new RangeError(
      `exportDocument: frameRange must be integers in [0, ${durationFrames}] with start < end (got start=${range.start}, end=${range.end})`,
    );
  }
}
