// packages/runtimes/audience/src/clips/live-quiz/factory.ts
// T-465 — `AudienceClipFactory` for the `live-quiz` clip.
// Three-state router (ADR-010 §D8) decides the mount path:
//   - `live`              → open `runAudienceClient` against
//                           `ctx.provider.subscribe({ sessionId, ...})`,
//                           re-render on each `AggregationSnapshot`.
//   - `staticFallback`    → render once from the inlined snapshot in
//                           `ctx.provenance.aggregation`.
//   - `empty-live-mount`  → render the "Waiting for next question…"
//                           placeholder (no questionResults, no active
//                           question).
//
// The factory mounts a React tree on `ctx.root` via `react-dom/client`'s
// `createRoot`. Disposes on `signal.abort()` per AC #15-#17 of T-389
// (the precedent).
//
// Determinism (CLAUDE.md §3): the audience runtime IS inside the
// perimeter. This module's only non-deterministic surface is
// `runAudienceClient` (the WebSocket subscribe loop), which is
// `determinism-safe`-tagged at the boundary per ADR-009 §D2 / §D6.
// The static-fallback render is pure.

import type {
  AggregationSnapshot,
  AudienceProvenance,
  LiveQuizAggregation,
} from '@stageflip/audience-contract';
import { type LiveQuizClipProps, liveQuizClipPropsSchema } from '@stageflip/schema';
import { type Root, createRoot } from 'react-dom/client';

import { runAudienceClient } from '../../audience-client.js';
import {
  type AudienceClipFactory,
  type AudienceMountContext,
  type AudienceMountHandle,
  routeMountState,
} from '../../contract.js';
import { renderLiveQuizStaticFallback } from './static-fallback.js';

/**
 * Internal mount-state — the React root + the most-recent aggregation.
 * Replaced on each snapshot; render is idempotent.
 */
interface MountState {
  reactRoot: Root;
  aggregation: LiveQuizAggregation;
  disposed: boolean;
}

/**
 * Render the current `MountState` to its React root. Idempotent — safe
 * to call on every snapshot tick.
 */
function paint(state: MountState, props: LiveQuizClipProps, width: number, height: number): void {
  if (state.disposed) return;
  const ctx: {
    width: number;
    height: number;
    questions?: readonly { id: string; text: string; options: readonly string[] }[];
  } = {
    width,
    height,
    questions: props.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
    })),
  };
  const tree = renderLiveQuizStaticFallback({
    snapshot: state.aggregation,
    context: ctx,
  });
  state.reactRoot.render(tree);
}

/**
 * `AudienceClipFactory` implementation. Browser-only — `createRoot` is
 * react-dom/client.
 */
export const liveQuizClipFactory: AudienceClipFactory = async (
  ctx: AudienceMountContext,
): Promise<AudienceMountHandle> => {
  // 1. Parse props from `ctx.clip`. The audience runtime's MountContext
  //    inherits its `clip` shape from the interactive tier (which uses
  //    the InteractiveClip-shaped `liveMount.props`); the audience clip
  //    element types its props directly under `clip.props`. We accept
  //    either shape to keep the factory portable across the two
  //    schema-side authoring paths until the audience runtime ships its
  //    own MountContext refinement.
  const clipShape = ctx.clip as unknown as {
    readonly props?: unknown;
    readonly liveMount?: { readonly props?: unknown };
    readonly transform?: { readonly width?: number; readonly height?: number };
  };
  const rawProps = clipShape.props ?? clipShape.liveMount?.props;
  const propsResult = liveQuizClipPropsSchema.safeParse(rawProps);
  if (!propsResult.success) {
    throw new Error(`liveQuizClipFactory: invalid props — ${propsResult.error.message}`);
  }
  const props = propsResult.data;
  const width = clipShape.transform?.width ?? 800;
  const height = clipShape.transform?.height ?? 400;

  // 2. Determine the route. `routeMountState` is pure. We forward only
  //    fields that are actually defined to honour
  //    `exactOptionalPropertyTypes`.
  const routeInput: { sessionId?: string; provenance?: AudienceProvenance } = {};
  if (ctx.sessionId !== undefined) routeInput.sessionId = ctx.sessionId;
  if (ctx.provenance !== undefined) routeInput.provenance = ctx.provenance;
  const route = routeMountState(routeInput);

  // 3. Build the React root + initial aggregation.
  const initialAggregation: LiveQuizAggregation = (() => {
    if (route === 'staticFallback' && ctx.provenance !== undefined) {
      const inner = ctx.provenance.aggregation;
      if (inner.kind === 'live-quiz') return inner;
    }
    return {
      kind: 'live-quiz',
      activeQuestionId: null,
      questionResults: [],
      totalVoters: 0,
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
  //    forget — the loop self-disposes on `signal.abort()`. The
  //    determinism perimeter exemption rides on `runAudienceClient`'s
  //    own `determinism-safe` annotation.
  if (route === 'live' && ctx.sessionId !== undefined) {
    // Per ADR-009 §D2 the auth token MUST be present on a live mount.
    // Either the voter or presenter token is set (the host enforces
    // mutual exclusion); we forward whichever is present. An absent
    // token short-circuits the subscribe — the route is degraded to
    // "empty-live-mount" rendering until a token arrives via re-mount.
    const authToken = ctx.voterToken ?? ctx.presenterToken;
    if (authToken !== undefined) {
      const onSnapshot = (snapshot: AggregationSnapshot): void => {
        if (state.disposed) return;
        const inner = snapshot.aggregation;
        if (inner.kind !== 'live-quiz') return;
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
      // defensive: a unmount-mid-render can throw; non-actionable.
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
      // clip from the host's perspective. No-op here matches the T-389
      // ai-chat factory's stance.
    },
    dispose,
  };
  return handle;
};
