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

import { type CdpSession, LiveTierAdapter, type MountedComposition } from './adapter';
import { type AssetResolver, type LossFlag, resolveAssets } from './asset-resolver';
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
  /**
   * Optional asset preflight. When provided, every URL-bearing content
   * ref in the document is passed through the resolver; resolved URLs are
   * rewritten to `file://` paths before the session mounts. Loss-flagged
   * refs (refs the resolver refused) land in `ExportResult.lossFlags`
   * with their original URLs left intact — the session sees them remote.
   *
   * Omit to skip asset preflight entirely (URLs stay as-is).
   */
  readonly assetResolver?: AssetResolver;
}

export interface ExportResult {
  /**
   * Document as seen by the session. If `assetResolver` was provided and
   * rewrote any URLs, this is the rewritten document (not the input).
   */
  readonly document: RIRDocument;
  readonly preflight: PreflightReport;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly framesRendered: number;
  /** Asset refs the resolver refused. Empty when no resolver was supplied. */
  readonly lossFlags: readonly LossFlag[];
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
    // Ownership contract: once exportDocument is called, the dispatcher
    // owns sink.close lifecycle on every exit path — success or failure.
    // Swallow any close error here: the caller's actual problem is the
    // preflight blocker; a secondary close failure (e.g. FFmpegEncoder
    // exiting with "no stream" because it received no writes) would mask
    // the real diagnostic if allowed to propagate.
    await sink.close().catch(() => {});
    throw new PreflightBlockedError(report.blockers);
  }

  const adapter = new LiveTierAdapter(session);
  const range = opts.frameRange ?? { start: 0, end: document.durationFrames };
  let mounted: MountedComposition | null = null;
  let framesRendered = 0;
  let documentForSession = document;
  let lossFlags: readonly LossFlag[] = [];

  try {
    // Range validation lives inside try so its RangeError throws through
    // finally — sink is still closed on invalid input (owned since entry).
    validateFrameRange(range, document.durationFrames);

    // Asset preflight runs before mount so the session only ever sees
    // rewritten local URLs for refs the resolver fetched successfully.
    if (opts.assetResolver !== undefined) {
      const resolved = await resolveAssets(document, opts.assetResolver);
      documentForSession = resolved.document;
      lossFlags = resolved.lossFlags;
    }

    mounted = await adapter.mount(documentForSession);
    for (let frame = range.start; frame < range.end; frame++) {
      const buffer = await adapter.renderFrame(mounted, frame);
      await sink.onFrame(frame, buffer);
      framesRendered++;
    }
  } finally {
    if (mounted !== null) await adapter.close(mounted);
    await sink.close();
  }

  return {
    document: documentForSession,
    preflight: report,
    startFrame: range.start,
    endFrame: range.end,
    framesRendered,
    lossFlags,
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
