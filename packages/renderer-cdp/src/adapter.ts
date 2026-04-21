// packages/renderer-cdp/src/adapter.ts
// LiveTierAdapter — the single code path that renders any live-tier clip
// via CDP. No per-runtime branching: the registry (@stageflip/runtimes-
// contract `findClip`) already resolves kind → (runtime, clip), and the
// live runtimes all share the same React + FrameContext shape (Phase 3
// handover §3.4 "Seek-only discipline"). The only kind-specific concerns
// (WebGL context, font preflight) live below the adapter — in the CDP
// session impl and T-084a respectively.
//
// Scope for T-083 (see docs/escalation-T-083.md §P1):
//   - Pure dispatcher + orchestration layer (this file + dispatch.ts).
//   - `CdpSession` is the integration seam; real Puppeteer wiring lands
//     in T-084+, which implements `CdpSession` against the vendored
//     @hyperframes/engine.
//   - Two-pass bake is not here; T-089 [rev] owns bake orchestration.

import type { RIRDocument } from '@stageflip/rir';

import { type DispatchPlan, type UnresolvedClip, dispatchClips } from './dispatch';

/**
 * Composition-level config a session needs to set up its browser context:
 * viewport size and frame cadence. Pulled from RIRDocument at mount time.
 */
export interface CompositionConfig {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationFrames: number;
}

/**
 * Opaque session handle. Each CdpSession implementation decides its own
 * internal shape (e.g. a Puppeteer Page ref + bookkeeping); callers must
 * only pass the handle back to the session that issued it.
 */
export interface SessionHandle {
  readonly _handle: symbol;
}

/**
 * Integration seam. Real implementations wrap Puppeteer + the vendored
 * engine's browserManager / frameCapture services; test implementations
 * are plain objects that record calls. The adapter never invokes anything
 * outside this interface.
 */
export interface CdpSession {
  mount(plan: DispatchPlan, config: CompositionConfig): Promise<SessionHandle>;
  seek(handle: SessionHandle, frame: number): Promise<void>;
  capture(handle: SessionHandle): Promise<Uint8Array>;
  close(handle: SessionHandle): Promise<void>;
}

/** Result of mounting a document. Ready for per-frame rendering. */
export interface MountedComposition {
  readonly plan: DispatchPlan;
  readonly config: CompositionConfig;
  readonly handle: SessionHandle;
}

/**
 * Raised when `mount` is asked to render a document that contains clips
 * no registered runtime claims (or whose declared runtime does not match
 * the one that claims the kind). Fail-loud: silently rendering a document
 * with missing clips would produce a degraded export that scores badly in
 * the parity harness without any explicit signal.
 */
export class DispatchUnresolvedError extends Error {
  public readonly unresolved: readonly UnresolvedClip[];

  constructor(unresolved: readonly UnresolvedClip[]) {
    const summary = unresolved
      .map((u) => `${u.reason}: ${u.requestedRuntime}:${u.requestedKind} (element ${u.element.id})`)
      .join('; ');
    super(`dispatch failed: ${unresolved.length} clip(s) unresolved — ${summary}`);
    this.name = 'DispatchUnresolvedError';
    this.unresolved = unresolved;
  }
}

/**
 * The live-tier CDP adapter. One instance wraps one session; a single
 * session may host multiple concurrently-mounted compositions (each with
 * its own SessionHandle).
 */
export class LiveTierAdapter {
  constructor(private readonly session: CdpSession) {}

  async mount(document: RIRDocument): Promise<MountedComposition> {
    const plan = dispatchClips(document);
    if (plan.unresolved.length > 0) {
      throw new DispatchUnresolvedError(plan.unresolved);
    }
    const config: CompositionConfig = {
      width: document.width,
      height: document.height,
      fps: document.frameRate,
      durationFrames: document.durationFrames,
    };
    const handle = await this.session.mount(plan, config);
    return { plan, config, handle };
  }

  async renderFrame(mounted: MountedComposition, frame: number): Promise<Uint8Array> {
    if (!Number.isInteger(frame) || frame < 0 || frame >= mounted.config.durationFrames) {
      throw new RangeError(
        `renderFrame: frame must be an integer in [0, ${mounted.config.durationFrames}), got ${frame}`,
      );
    }
    await this.session.seek(mounted.handle, frame);
    return this.session.capture(mounted.handle);
  }

  async close(mounted: MountedComposition): Promise<void> {
    await this.session.close(mounted.handle);
  }
}
