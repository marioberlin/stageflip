// packages/runtimes/audience/src/clips/reaction-stream/factory.ts
// T-470 — `AudienceClipFactory` for the `reaction-stream` clip.
// Three-state router (ADR-010 §D8) decides the mount path:
//   - `live`              → open `runAudienceClient` against
//                           `ctx.provider.subscribe({ sessionId, ...})`,
//                           re-render on each `AggregationSnapshot`.
//   - `staticFallback`    → render once from the inlined snapshot in
//                           `ctx.provenance.aggregation`.
//   - `empty-live-mount`  → render the "Waiting for reactions…"
//                           placeholder over the shader canvas.
//
// The factory mounts a React tree on `ctx.root` via `react-dom/client`'s
// `createRoot`. Disposes on `signal.abort()` per the audience-runtime
// precedent.
//
// Determinism (CLAUDE.md §3): the audience runtime IS inside the
// perimeter. This module's only non-deterministic surface is
// `runAudienceClient` (the WebSocket subscribe loop), which is
// `determinism-safe`-tagged at the boundary per ADR-009 §D2 / §D6.
// The static-fallback render + the `computeReactionStreamUniforms` step
// are pure.

import type {
  AggregationSnapshot,
  AudienceProvenance,
  ReactionStreamAggregation,
} from '@stageflip/audience-contract';
import { type ReactionStreamClipProps, reactionStreamClipPropsSchema } from '@stageflip/schema';
import { type Root, createRoot } from 'react-dom/client';

import { runAudienceClient } from '../../audience-client.js';
import {
  type AudienceClipFactory,
  type AudienceMountContext,
  type AudienceMountHandle,
  routeMountState,
} from '../../contract.js';
import { renderReactionStreamStaticFallback } from './static-fallback.js';

/**
 * Internal mount-state — the React root + the most-recent aggregation.
 * Replaced on each snapshot; render is idempotent.
 */
interface MountState {
  reactRoot: Root;
  aggregation: ReactionStreamAggregation;
  disposed: boolean;
}

/**
 * Render the current `MountState` to its React root. Idempotent — safe
 * to call on every snapshot tick.
 */
function paint(
  state: MountState,
  props: ReactionStreamClipProps,
  width: number,
  height: number,
): void {
  if (state.disposed) return;
  const tree = renderReactionStreamStaticFallback({
    snapshot: state.aggregation,
    context: {
      width,
      height,
      prompt: props.prompt,
      palette: props.palette,
    },
  });
  state.reactRoot.render(tree);
}

/**
 * `AudienceClipFactory` implementation. Browser-only — `createRoot` is
 * react-dom/client.
 */
export const reactionStreamClipFactory: AudienceClipFactory = async (
  ctx: AudienceMountContext,
): Promise<AudienceMountHandle> => {
  // 1. Parse props from `ctx.clip`. Mirrors the other audience clip
  //    factories.
  const clipShape = ctx.clip as unknown as {
    readonly props?: unknown;
    readonly liveMount?: { readonly props?: unknown };
    readonly transform?: { readonly width?: number; readonly height?: number };
  };
  const rawProps = clipShape.props ?? clipShape.liveMount?.props;
  const propsResult = reactionStreamClipPropsSchema.safeParse(rawProps);
  if (!propsResult.success) {
    throw new Error(`reactionStreamClipFactory: invalid props — ${propsResult.error.message}`);
  }
  const props = propsResult.data;
  const width = clipShape.transform?.width ?? 800;
  const height = clipShape.transform?.height ?? 600;

  // 2. Determine the route. `routeMountState` is pure. We forward only
  //    fields that are actually defined to honour
  //    `exactOptionalPropertyTypes`.
  const routeInput: { sessionId?: string; provenance?: AudienceProvenance } = {};
  if (ctx.sessionId !== undefined) routeInput.sessionId = ctx.sessionId;
  if (ctx.provenance !== undefined) routeInput.provenance = ctx.provenance;
  const route = routeMountState(routeInput);

  // 3. Build the React root + initial aggregation.
  const initialAggregation: ReactionStreamAggregation = (() => {
    if (route === 'staticFallback' && ctx.provenance !== undefined) {
      const inner = ctx.provenance.aggregation;
      if (inner.kind === 'reaction-stream') return inner;
    }
    return {
      kind: 'reaction-stream',
      emojiCounts: [],
      totalReactions: 0,
    };
  })();

  const state: MountState = {
    reactRoot: createRoot(ctx.root),
    aggregation: initialAggregation,
    disposed: false,
  };
  paint(state, props, width, height);

  // 4. Live route: open the audience-client subscribe loop. Awaiting it
  //    here would block the factory's promise; we deliberately fire-and-
  //    forget — the loop self-disposes on `signal.abort()`.
  if (route === 'live' && ctx.sessionId !== undefined) {
    const authToken = ctx.voterToken ?? ctx.presenterToken;
    if (authToken !== undefined) {
      const onSnapshot = (snapshot: AggregationSnapshot): void => {
        if (state.disposed) return;
        const inner = snapshot.aggregation;
        if (inner.kind !== 'reaction-stream') return;
        state.aggregation = inner;
        paint(state, props, width, height);
      };
      void runAudienceClient({
        provider: ctx.provider,
        subscribeCall: { sessionId: ctx.sessionId, authToken },
        onSnapshot,
        emitLossFlag: ctx.emitLossFlag,
        signal: ctx.signal,
      });
    }
  }

  // 5. Dispose discipline: tear down the React root on `signal.abort`.
  const dispose = (): void => {
    if (state.disposed) return;
    state.disposed = true;
    try {
      state.reactRoot.unmount();
    } catch {
      // defensive: an unmount-mid-render can throw; non-actionable.
    }
  };

  if (ctx.signal.aborted) {
    dispose();
  } else {
    ctx.signal.addEventListener('abort', dispose, { once: true });
  }

  const handle: AudienceMountHandle = {
    updateProps: () => {
      // Props are mount-time configuration; runtime updates re-mount the
      // clip from the host's perspective. No-op matches the other
      // audience clip factories.
    },
    dispose,
  };
  return handle;
};
