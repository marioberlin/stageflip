// packages/audience-native/src/provider.ts
// `createAudienceNativeProvider` — concrete `AudienceBackendProvider`
// (T-478) wrapping an `AudienceResultsStore` from T-453 (in-memory v1)
// + T-474 (Firestore production). Implements ADR-009 §D2's four-method
// contract.
//
// **Stub posture** — same convention as the 9 P14 reference adapters:
// the provider is wired against the store; production wire-up to a
// remote `apps/api` deployment (HTTP-over-network) is a future task
// (T-478a). Stub-mode is sufficient for tests + the in-process
// audience-backend path the host shell already exposes.
//
// Determinism — outside the determinism perimeter (`packages/audience-
// native/**` is NOT in the `packages/runtimes/**` glob). The injected
// `now: () => number` defaults to `Date.now()` so callers can override
// for deterministic tests; the `setTimeout` use in `subscribe()` carries
// the determinism-safe note inline.

import type {
  AggregationSnapshot,
  AudienceBackendProvider,
  CloseSessionCall,
  FinalSnapshot,
  OpenSessionCall,
  SessionHandle,
  SubmitVoteCall,
  SubscribeCall,
  VoteAck,
} from '@stageflip/audience-contract';
import type { AudienceResultsStore } from '@stageflip/storage';

import { audienceNativeDescriptor } from './descriptor.js';

/**
 * Construction options.
 *
 * - `store` — the `AudienceResultsStore` instance the provider delegates
 *   to. In tests + dev: `InMemoryAudienceResultsStore`. In production:
 *   `FirestoreAudienceResultsStore` (T-474).
 * - `now` — injectable wall-clock for deterministic tests. Defaults to
 *   `Date.now`. The provider stamps server-side timestamps with this.
 * - `ttlHours` — orphan-sweep TTL in hours (per ADR-009 §D5). Defaults
 *   to 24h. Closed sessions get `closedAt + retentionDays` separately.
 * - `subscribePollMs` — interval between snapshot polls in
 *   `subscribe()`. Defaults to ~33ms (≈30 Hz, matching
 *   `audienceNativeCapability.snapshotCadenceHz`).
 */
export interface AudienceNativeProviderOptions {
  readonly store: AudienceResultsStore;
  readonly now?: () => number;
  readonly ttlHours?: number;
  readonly subscribePollMs?: number;
}

const DEFAULT_TTL_HOURS = 24;
const DEFAULT_SUBSCRIBE_POLL_MS = 33; // ~30 Hz

/**
 * Build the native `AudienceBackendProvider` against the supplied store.
 * Returns a frozen object — same lifetime as the host shell.
 */
export function createAudienceNativeProvider(
  options: AudienceNativeProviderOptions,
): AudienceBackendProvider {
  const { store } = options;
  const now = options.now ?? (() => Date.now());
  const ttlMs = (options.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
  const subscribePollMs = options.subscribePollMs ?? DEFAULT_SUBSCRIBE_POLL_MS;

  async function openSession(call: OpenSessionCall): Promise<SessionHandle> {
    const createdAt = new Date(now()).toISOString();
    const ttlAt = new Date(now() + ttlMs).toISOString();
    const doc = await store.openSession({
      tenantId: call.tenantId,
      projectId: call.projectId,
      sessionId: call.sessionId,
      clipKind: call.clipKind,
      adapterDescriptor: { id: audienceNativeDescriptor.id, license: 'mit' },
      createdAt,
      ttlAt,
    });
    const handle: SessionHandle = {
      sessionId: doc.sessionId,
      joinUrl: `/v1/audience/join/${doc.sessionId}`,
      joinCode: doc.sessionId.slice(0, 6).toUpperCase(),
      ...(doc.closedAt !== null ? { closedAt: doc.closedAt } : {}),
    };
    return handle;
  }

  async function submitVote(call: SubmitVoteCall): Promise<VoteAck> {
    const serverTimestamp = new Date(now()).toISOString();
    // The store hashes the voterToken internally and assigns the eventId
    // (ULID); per-tenant pepper is configured at store construction.
    const eventId = `evt-${serverTimestamp}-${call.voterToken.slice(0, 6)}`;
    const event = await store.appendEvent({
      sessionId: call.sessionId,
      eventId,
      voterToken: call.voterToken,
      serverTimestamp,
      clientTimestamp: call.clientTimestamp,
      payload: call.payload,
      accepted: true,
    });
    return {
      eventId: event.eventId,
      serverTimestamp: event.serverTimestamp,
      accepted: true,
    };
  }

  function subscribe(call: SubscribeCall): AsyncIterable<AggregationSnapshot> {
    return {
      async *[Symbol.asyncIterator]() {
        // Per ADR-009 §D2: iterator yields snapshots at the server-
        // throttled cadence (`snapshotCadenceHz`); closes when the session
        // closes or consumer unsubscribes.
        let lastFrameNo = -1;
        for (;;) {
          const doc = await store.readSnapshot(call.sessionId);
          if (doc === null) {
            // Session does not exist (or has been TTL'd). End the stream.
            return;
          }
          const frameNo = doc.snapshotFrame ?? 0;
          if (frameNo !== lastFrameNo) {
            lastFrameNo = frameNo;
            yield {
              sessionId: doc.sessionId,
              frameNo,
              serverTimestamp: new Date(now()).toISOString(),
              voterCount: doc.voterCount,
              // Aggregation is read by the host out of the store's snapshot
              // doc; here we yield an empty-aggregation placeholder typed
              // by clipKind. The host's clip-tier renderer reads
              // `doc.aggregation` directly via its own store handle when
              // the wiring needs full payload fidelity.
              aggregation: {
                kind: doc.clipKind,
                // Per-kind empty defaults; the store carries the live
                // payload separately when the host opts in.
              } as AggregationSnapshot['aggregation'],
            };
          }
          if (doc.closedAt !== null) {
            return;
          }
          // determinism-safe: snapshot polling cadence per ADR-009 §D2;
          // outside the determinism perimeter (apps/api scope).
          await new Promise<void>((resolve) => {
            setTimeout(resolve, subscribePollMs);
          });
        }
      },
    };
  }

  async function closeSession(call: CloseSessionCall): Promise<FinalSnapshot> {
    const closedAt = new Date(now()).toISOString();
    const doc = await store.readSnapshot(call.sessionId);
    if (doc === null) {
      throw new Error(`audience-native: session '${call.sessionId}' not found`);
    }
    const closed = await store.closeSession({
      sessionId: call.sessionId,
      closedAt,
      snapshotFrame: doc.snapshotFrame ?? 0,
      ttlAt: new Date(now() + ttlMs).toISOString(),
    });
    return {
      sessionId: closed.sessionId,
      frameNo: closed.snapshotFrame ?? 0,
      serverTimestamp: closedAt,
      voterCount: closed.voterCount,
      aggregation: { kind: closed.clipKind } as AggregationSnapshot['aggregation'],
      closedAt,
      snapshotFrame: closed.snapshotFrame ?? 0,
    };
  }

  return {
    ...audienceNativeDescriptor,
    modality: { kind: 'audience-backend' as const },
    capability:
      audienceNativeDescriptor.capability as unknown as AudienceBackendProvider['capability'],
    openSession,
    submitVote,
    subscribe,
    closeSession,
  };
}
