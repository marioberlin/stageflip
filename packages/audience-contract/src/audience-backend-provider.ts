// packages/audience-contract/src/audience-backend-provider.ts
// `AudienceBackendProvider` interface — verbatim from ADR-009 §D2.
// Extends `AdapterDescriptor` from T-418. Four methods:
// `openSession` / `submitVote` / `subscribe` / `closeSession`.
//
// Native + every vendor adapter (audience-native, audience-slido,
// audience-mentimeter, audience-polleverywhere, audience-vevox,
// audience-wooclap) implements this interface; per-vendor mismatches
// (e.g., Slido does not support Heatmap) surface via
// `capability.supportedClipKinds` filtering, not interface variation.

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { AggregationSnapshot, FinalSnapshot } from './aggregation-snapshot.js';
import type { AudienceCapabilityDescriptor, AudienceClipKind } from './capability.js';
import type { VotePayload } from './vote-payload.js';

// ----------------------------------------------------------------------------
// Call / result shapes (ADR-009 §D2)
// ----------------------------------------------------------------------------

/**
 * Per-`openSession` input. `sessionId` is a ULID supplied by the editor;
 * calling `openSession` with the same `(tenantId, projectId, sessionId)`
 * twice MUST return a handle for the existing session (idempotency per
 * ADR-009 §D2).
 */
export interface OpenSessionCall {
  readonly tenantId: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly clipKind: AudienceClipKind;
  /** Provider-specific opaque options (e.g., Slido pollId, Mentimeter sessionCode). */
  readonly options?: Readonly<Record<string, unknown>>;
}

/**
 * Handle returned by `openSession`. The `joinUrl` + `joinCode` are the
 * voter-side entry points the voter landing page (T-456) surfaces.
 * `closedAt` is set if the session was already closed.
 */
export interface SessionHandle {
  readonly sessionId: string;
  readonly joinUrl: string; // QR / participant landing URL (T-456)
  readonly joinCode: string; // short code for manual entry
  readonly closedAt?: string;
}

/**
 * Per-`submitVote` input. `voterToken` is the opaque per-voter identifier
 * (per ADR-009 §D7); the backend hashes it at rest (per ADR-009 §D5).
 * `clientTimestamp` is the voter's wall-clock; the server stamps the
 * authoritative time on the resulting `VoteAck`.
 */
export interface SubmitVoteCall {
  readonly sessionId: string;
  readonly voterToken: string;
  readonly payload: VotePayload;
  readonly clientTimestamp: string; // ISO 8601
}

/**
 * Acknowledgement from `submitVote`. Per ADR-009 §D2.
 *
 * `accepted === false` MUST set `rejectReason` (e.g., rate-limited,
 * session-closed, vote-not-allowed-for-this-kind). The ack is durable —
 * the event is in the `events/` sub-collection before the ack returns.
 */
export interface VoteAck {
  readonly eventId: string;
  readonly serverTimestamp: string; // ISO 8601
  readonly accepted: boolean;
  readonly rejectReason?: string;
}

/**
 * Per-`subscribe` input. The auth token's role gates the view: admin tokens
 * see full aggregation; presenter-only tokens see the presenter view;
 * voter tokens MAY see a public view per the clip kind.
 */
export interface SubscribeCall {
  readonly sessionId: string;
  readonly authToken: string;
}

/**
 * Per-`closeSession` input. The auth token must carry admin-or-presenter
 * scope; voter tokens MUST NOT be admitted.
 */
export interface CloseSessionCall {
  readonly sessionId: string;
  readonly authToken: string;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-009 §D2)
// ----------------------------------------------------------------------------

/**
 * `AudienceBackendProvider` extends `AdapterDescriptor` with the four-method
 * audience-backend contract surface. Per ADR-009 §D2.
 *
 * The `modality.kind` is narrowed to the literal `'audience-backend'` so
 * consumers can branch on the provider type after a
 * `descriptor.modality.kind === 'audience-backend'` check; `capability`
 * is narrowed to `AudienceCapabilityDescriptor` (the base
 * `AdapterDescriptor.capability` is opaque per ADR-007 §D1).
 *
 * **Why one interface for native + vendor** (ADR-009 §D2): per-vendor
 * mismatches surface via `capability.supportedClipKinds`, not interface
 * variation. The native backend implements this against `apps/api` +
 * Firestore (T-453 + T-478). Each vendor bridge
 * (T-479..T-483) implements the same interface against the vendor's API.
 */
export interface AudienceBackendProvider
  extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'audience-backend' };
  readonly capability: AudienceCapabilityDescriptor;

  /**
   * Open a session bound to a clip kind + tenant + project. Returns a
   * `SessionHandle` the clip's liveMount path uses to push vote events
   * (voter side) or subscribe to aggregation snapshots (presenter side).
   *
   * Calling the same `(tenantId, projectId, sessionId)` twice MUST return a
   * handle for the existing session — `openSession` is idempotent so a
   * reconnect after a transient network failure picks up where it left off.
   */
  openSession(call: OpenSessionCall): Promise<SessionHandle>;

  /**
   * Submit one vote event. Returns once the event is acknowledged by the
   * backend (durably persisted in the `events/` sub-collection). MUST NOT
   * block waiting for the next snapshot; snapshots flow over the
   * `subscribe()` stream.
   */
  submitVote(call: SubmitVoteCall): Promise<VoteAck>;

  /**
   * Subscribe to aggregation snapshots. Returns an `AsyncIterable` the
   * presenter UI consumes; snapshots flow at the server-throttled cadence
   * declared by `capability.snapshotCadenceHz`. Iterator closes when the
   * session is closed (server-initiated) or when the consumer unsubscribes.
   */
  subscribe(call: SubscribeCall): AsyncIterable<AggregationSnapshot>;

  /**
   * Close the session. Server stops accepting votes; final aggregation
   * snapshot is persisted as the session's authoritative result the
   * `staticFallback` path consumes at export time. Per ADR-010 §D4.
   */
  closeSession(call: CloseSessionCall): Promise<FinalSnapshot>;
}
