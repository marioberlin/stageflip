// packages/runtimes/audience/src/contract.ts
// `AudienceMountContext` / `AudienceMountHandle` — the audience-tier
// extension of T-306's `MountContext` / `MountHandle` per ADR-003 §D1 +
// ADR-009 §D2 + ADR-010 §D8. The audience runtime adds:
//   - `provider: AudienceBackendProvider` (resolved by the router at mount
//     time per ADR-009 §D2; one provider per active session).
//   - `sessionId: AudienceSessionId` (the open session this mount attaches
//     to; one per active audience clip on the slide).
//   - `voterToken?` / `presenterToken?` (mount role discriminators per
//     ADR-009 §D2 / §D7).
//   - `provenance?: AudienceProvenance` (the static-fallback inlined
//     snapshot per ADR-010 §D4 / §D5 — present when the clip mounts
//     without a live session).
//   - `emitLossFlag: (input) => void` (browser-safe loss-flag plumbing per
//     ADR-009 §D11; the host wraps `@stageflip/loss-flags`' `emitLossFlag`
//     in a Node-side process and forwards the serialised flag, keeping the
//     runtime browser-pure).
//
// Browser-safe — no Node-only imports. The contract is consumed by the
// nine v1 audience clip families (T-461..T-471) plus the host editor /
// renderer that mounts them.

import type {
  AudienceBackendProvider,
  AudienceClipKind,
  AudienceProvenance,
  LossFlagAudienceCode,
} from '@stageflip/audience-contract';
import type { LossFlag } from '@stageflip/loss-flags';
import type { MountContext, MountHandle } from '@stageflip/runtimes-interactive';

/**
 * Stable audience-session id (the ULID supplied by the editor per
 * ADR-009 §D2). Aliased here for callsite clarity — the underlying type
 * is a plain branded string.
 */
export type AudienceSessionId = string;

/**
 * Loss-flag emission input — browser-safe analog of
 * `@stageflip/loss-flags`' `EmitLossFlagInput`. Severity + category are
 * resolved by the host wrapper from `LF_AUDIENCE_SPECS` so the runtime
 * call-site supplies only the code, message, and location material. The
 * host returns the materialised `LossFlag` for downstream sinks
 * (presenter UI, structured log).
 */
export interface AudienceLossFlagEmission {
  /** Audience code — narrowed to the eight `LF-AUDIENCE-*` discriminants. */
  readonly code: LossFlagAudienceCode;
  /** Plain-English description of the condition. */
  readonly message: string;
  /** Optional location material the deterministic-id hash folds in. */
  readonly location?: LossFlag['location'];
  /** Optional caller-supplied recovery hint. */
  readonly recovery?: string;
}

/**
 * Host-supplied loss-flag emitter. Browser-safe: the host wraps the
 * Node-side `emitLossFlag` (which uses `node:crypto`) and forwards the
 * resulting `LossFlag` over its existing telemetry channel. Returning
 * `void` keeps the call site fire-and-forget; sinks live with the host.
 */
export type AudienceEmitLossFlag = (emission: AudienceLossFlagEmission) => void;

/**
 * The mount-time inputs handed to an audience clip factory. Extends
 * T-306's `MountContext` verbatim: `clip`, `root`, `permissions`,
 * `tenantPolicy`, `emitTelemetry`, `signal`, `frameSource`,
 * `permissionPrePrompt` flow through unchanged. Adds the audience-tier
 * surface (provider, sessionId, role tokens, provenance, loss-flag
 * emitter).
 *
 * Three-state routing per ADR-010 §D8 (see `routeMountState`):
 *  - `sessionId` present → `live` mount (factory reads aggregation
 *    snapshots via `provider.subscribe()` through `AudienceClient`).
 *  - `provenance` present, no `sessionId` → `staticFallback` mount
 *    (factory renders deterministically from the inlined snapshot).
 *  - neither → `empty-live-mount` (factory renders a "no live data yet"
 *    hint per-clip-kind).
 */
export interface AudienceMountContext extends MountContext {
  /**
   * Provider that hosts this mount's audience session. Resolved by the
   * router at mount time per ADR-009 §D2 — native (T-478) or a vendor
   * adapter (T-479..T-483). Provider-agnostic interface; the factory does
   * not branch on `provider.id` for behaviour.
   */
  readonly provider: AudienceBackendProvider;

  /**
   * Open session this mount attaches to. Optional — absent in
   * `staticFallback` and `empty-live-mount` routes. When present, the
   * factory opens an `AudienceClient` against
   * `provider.subscribe({ sessionId, authToken })`.
   */
  readonly sessionId?: AudienceSessionId;

  /**
   * Opaque voter token per ADR-009 §D7 — present when this mount is a
   * voter view. Mutually exclusive with `presenterToken` in normal
   * operation; the host enforces the exclusion at mount-router level.
   */
  readonly voterToken?: string;

  /**
   * Opaque presenter / admin token — present when this mount is the
   * presenter view that subscribes to full aggregation snapshots.
   * Mutually exclusive with `voterToken`.
   */
  readonly presenterToken?: string;

  /**
   * Inlined static-fallback payload per ADR-010 §D4 / §D5. Optional —
   * present when the clip mounts without a live session (export time, or
   * authoring after session close). Carries `aggregation`,
   * `snapshotPolicy`, `snapshotFrame`, `clipKind`, `voterCountAtCapture`,
   * `provider`, `sessionId`, `capturedAt`.
   */
  readonly provenance?: AudienceProvenance;

  /** Loss-flag emitter wired through to `@stageflip/loss-flags`. */
  readonly emitLossFlag: AudienceEmitLossFlag;
}

/**
 * Imperative handle returned by an audience clip factory. Extends T-306's
 * `MountHandle` verbatim — no audience-specific imperative surface
 * beyond the parent's `updateProps` + `dispose`. The factory's internal
 * `AudienceClient` is disposed by `dispose()` (or by `signal.abort()`
 * via the parent harness).
 */
export type AudienceMountHandle = MountHandle;

/**
 * The contract an audience clip family implements. Factories are
 * registered with `audienceClipRegistry` at clip-package import time
 * (T-461..T-471). Async to leave room for dynamic-import setup +
 * WebSocket handshake + provenance hydration.
 */
export type AudienceClipFactory = (ctx: AudienceMountContext) => Promise<AudienceMountHandle>;

/**
 * Routing decision per ADR-010 §D8. Pure function of `(sessionId,
 * provenance)`:
 *  - `live` — `sessionId` present (with or without provenance — the
 *    session wins).
 *  - `staticFallback` — `provenance` present, `sessionId` absent.
 *  - `empty-live-mount` — both absent.
 */
export type AudienceMountRoute = 'live' | 'staticFallback' | 'empty-live-mount';

/**
 * Decide which of the three routes applies to a given mount context.
 * Pure, deterministic, allocation-free.
 */
export function routeMountState(input: {
  readonly sessionId?: string;
  readonly provenance?: AudienceProvenance;
}): AudienceMountRoute {
  if (input.sessionId !== undefined) return 'live';
  if (input.provenance !== undefined) return 'staticFallback';
  return 'empty-live-mount';
}

/**
 * Audience-clip-kind universe per ADR-009 §D2 — eleven discriminants.
 * Re-exported from `@stageflip/audience-contract` so registry consumers
 * pick up the const-array via the runtime package without taking a
 * direct dep on the contract.
 */
export type AudienceClipKindUniverse = AudienceClipKind;
