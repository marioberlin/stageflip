// packages/runtimes/audience/src/three-state-router.ts
// Three-state mount router per ADR-010 §D8. Pure dispatch over
// `(sessionId, provenance)` → one of `live` / `staticFallback` /
// `empty-live-mount`. Routes a clip-factory through one of three
// branches:
//
//   1. `live` — open AudienceClient against `provider.subscribe()`
//      and hand subsequent `AggregationSnapshot`s to the per-kind
//      factory.
//   2. `staticFallback` — dispatch through `StaticFallbackRenderer`
//      using the inlined `AudienceProvenance` payload.
//   3. `empty-live-mount` — render the per-kind "no live data yet"
//      hint (factory-specific; T-461..T-471 supply the visuals).
//
// T-454 ships the dispatcher + the routing primitive. Per-branch
// behaviour lives behind a per-kind plug — the router does not
// branch on `clipKind`.

import type { AudienceProvenance } from '@stageflip/audience-contract';

import type { AudienceMountContext, AudienceMountHandle, AudienceMountRoute } from './contract.js';
import { routeMountState } from './contract.js';

/**
 * Per-route handler signatures. The router invokes exactly one of these
 * per mount. All three are async — the live branch awaits the
 * `AudienceClient` opening + first snapshot; the fallback branch awaits
 * the per-kind factory; the empty branch awaits the per-kind hint
 * factory.
 */
export interface ThreeStateHandlers {
  /**
   * Mount a live audience session. `sessionId` is guaranteed present;
   * the implementer opens an `AudienceClient` against
   * `provider.subscribe(sessionId, presenter|voter token)`.
   */
  readonly mountLive: (
    ctx: AudienceMountContext & { readonly sessionId: string },
  ) => Promise<AudienceMountHandle>;
  /**
   * Render the inlined static-fallback snapshot. `provenance` is
   * guaranteed present.
   */
  readonly mountStaticFallback: (
    ctx: AudienceMountContext & { readonly provenance: AudienceProvenance },
  ) => Promise<AudienceMountHandle>;
  /**
   * Render the per-kind "no live data yet" hint. Neither `sessionId`
   * nor `provenance` is present.
   */
  readonly mountEmpty: (ctx: AudienceMountContext) => Promise<AudienceMountHandle>;
}

/**
 * Per-mount routing result. The handler that actually fired is named so
 * callers (tests + host telemetry) can pin which branch executed without
 * re-deriving from `(sessionId, provenance)`.
 */
export interface ThreeStateMountResult {
  readonly route: AudienceMountRoute;
  readonly handle: AudienceMountHandle;
}

/**
 * Dispatch a mount across the three routes. Pure — the router does not
 * own state. The factory's `dispose()` is the caller's responsibility
 * to invoke on unload.
 */
export async function dispatchMount(
  ctx: AudienceMountContext,
  handlers: ThreeStateHandlers,
): Promise<ThreeStateMountResult> {
  const route = routeMountState({
    ...(ctx.sessionId !== undefined ? { sessionId: ctx.sessionId } : {}),
    ...(ctx.provenance !== undefined ? { provenance: ctx.provenance } : {}),
  });

  switch (route) {
    case 'live': {
      // sessionId guaranteed present by routeMountState's contract
      const liveCtx = ctx as AudienceMountContext & { readonly sessionId: string };
      const handle = await handlers.mountLive(liveCtx);
      return { route, handle };
    }
    case 'staticFallback': {
      const fbCtx = ctx as AudienceMountContext & {
        readonly provenance: AudienceProvenance;
      };
      const handle = await handlers.mountStaticFallback(fbCtx);
      return { route, handle };
    }
    case 'empty-live-mount': {
      const handle = await handlers.mountEmpty(ctx);
      return { route, handle };
    }
  }
}
