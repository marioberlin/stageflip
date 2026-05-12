// packages/storage-firebase/src/audience-results.ts
// T-474 — Firestore-backed `AudienceResultsStore` per ADR-009 §D5.
// Targets the `audience-sessions/{sessionId}` collection with an
// append-only `events/{eventId}` sub-collection. Per-tenant region
// routing is the wiring layer's responsibility (T-411b region-router);
// this factory accepts whichever Firestore the caller hands it.
//
// The factory uses structural `FirestoreDocRefLike` /
// `FirestoreCollectionRefLike` / `FirestoreQueryLike` shims (mirrors
// `tenant-settings.ts`) so unit tests run without an emulator. The
// real `Firestore` from firebase-admin satisfies these structurally;
// tests pass an in-memory shim.
//
// Voter-token hashing: SHA-256(pepper + plaintext_token), hex-encoded —
// matches the `InMemoryAudienceResultsStore` algorithm bit-for-bit so
// the same plaintext + pepper hashes identically across adapters
// (mandatory for cross-adapter parity per ADR-009 §D5 voter-hashing
// invariant).

import { createHash } from 'node:crypto';

import {
  type AppendEventInput,
  type AudienceEventDoc,
  type AudienceQuizState,
  type AudienceResultsStore,
  type AudienceSessionDoc,
  type CloseSessionInput,
  type ListEventsOptions,
  type OpenSessionInput,
  audienceEventDocSchema,
  audienceQuizStateSchema,
  audienceSessionDocSchema,
} from '@stageflip/storage';

const SESSIONS_COLLECTION = 'audience-sessions';
const EVENTS_SUBCOLLECTION = 'events';

/** Minimal Firestore document snapshot shape we read. */
export interface FirestoreDocSnapshotLike {
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
}

/** Minimal Firestore query snapshot shape we read on `list`. */
export interface FirestoreQuerySnapshotLike {
  readonly docs: ReadonlyArray<{
    readonly id: string;
    data(): Record<string, unknown> | undefined;
  }>;
}

/**
 * Minimal Firestore query shape — supports the chain
 * `.orderBy(field, dir).where(field, op, value).limit(n).get()`.
 * The chain returns a `FirestoreQueryLike` until `.get()` resolves
 * the `FirestoreQuerySnapshotLike`.
 */
export interface FirestoreQueryLike {
  orderBy(field: string, direction?: 'asc' | 'desc'): FirestoreQueryLike;
  where(field: string, op: '>' | '>=' | '<' | '<=' | '==', value: unknown): FirestoreQueryLike;
  limit(n: number): FirestoreQueryLike;
  get(): Promise<FirestoreQuerySnapshotLike>;
}

/** Minimal Firestore document reference shape we use. */
export interface FirestoreDocRefLike {
  get(): Promise<FirestoreDocSnapshotLike>;
  set(data: Record<string, unknown>): Promise<unknown>;
  /** Access a sub-collection rooted at this document. */
  collection(path: string): FirestoreCollectionRefLike;
}

/** Minimal Firestore collection reference shape we use. */
export interface FirestoreCollectionRefLike extends FirestoreQueryLike {
  doc(id: string): FirestoreDocRefLike;
}

/**
 * Structural shape of `firebase-admin/firestore` Firestore the
 * audience-results store needs. Real `Firestore` from firebase-admin
 * satisfies this; tests pass an in-memory shim.
 */
export interface FirestoreAudienceResultsLike {
  collection(path: string): FirestoreCollectionRefLike;
}

/** Factory options for `createFirebaseAudienceResultsStore`. */
export interface FirebaseAudienceResultsStoreOptions {
  /**
   * Firestore instance (use `regionRouter.getFirestoreForOrg(org)` per
   * region in production; pass an in-memory shim in tests).
   */
  readonly firestore: FirestoreAudienceResultsLike;
  /**
   * Voter-token hashing pepper. Must match the value used by other
   * adapters in the same deployment so voter-token hashes are
   * cross-adapter-stable (ADR-009 §D5).
   */
  readonly pepper: string;
}

/**
 * Compute `SHA-256(pepper + plaintext_token)` per ADR-009 §D5. Lower-case
 * hex so the format invariant in `audienceEventDocSchema` admits the
 * value.
 */
function hashVoterToken(pepper: string, plaintext: string): string {
  return createHash('sha256').update(pepper).update(plaintext).digest('hex');
}

/** Strip `undefined` keys so Firestore writes don't carry empty values. */
function compact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Build an `AudienceResultsStore` that persists to Firestore at
 * `audience-sessions/{sessionId}` per ADR-009 §D5. Per-region routing
 * is the wiring layer's responsibility (T-411b) — this factory accepts
 * whichever Firestore the caller hands it.
 *
 * The store hashes `voterToken` at the boundary; the persisted
 * `AudienceEventDoc` carries `voterTokenHash` (never the plaintext)
 * matching the in-memory adapter's algorithm bit-for-bit.
 */
export function createFirebaseAudienceResultsStore(
  opts: FirebaseAudienceResultsStoreOptions,
): AudienceResultsStore {
  if (opts.pepper.length === 0) {
    throw new Error('createFirebaseAudienceResultsStore: pepper must be non-empty');
  }
  const pepper = opts.pepper;
  const sessions = opts.firestore.collection(SESSIONS_COLLECTION);

  function eventsFor(sessionId: string): FirestoreCollectionRefLike {
    return sessions.doc(sessionId).collection(EVENTS_SUBCOLLECTION);
  }

  async function readSessionDoc(sessionId: string): Promise<AudienceSessionDoc | null> {
    const snap = await sessions.doc(sessionId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;
    return audienceSessionDocSchema.parse({ ...data, sessionId });
  }

  /** Persist a parsed session doc (the doc id is the sessionId). */
  async function writeSessionDoc(doc: AudienceSessionDoc): Promise<void> {
    const payload = compact({
      tenantId: doc.tenantId,
      projectId: doc.projectId,
      clipKind: doc.clipKind,
      createdAt: doc.createdAt,
      closedAt: doc.closedAt,
      voterCount: doc.voterCount,
      snapshotFrame: doc.snapshotFrame,
      adapterDescriptor: doc.adapterDescriptor,
      ttlAt: doc.ttlAt,
      quizState: doc.quizState,
    });
    await sessions.doc(doc.sessionId).set(payload);
  }

  return {
    async openSession(input: OpenSessionInput): Promise<AudienceSessionDoc> {
      const existing = await readSessionDoc(input.sessionId);
      if (existing) {
        if (existing.tenantId !== input.tenantId || existing.projectId !== input.projectId) {
          throw new Error(
            `openSession: sessionId ${input.sessionId} already exists for a different tenant/project`,
          );
        }
        return existing;
      }
      const doc: AudienceSessionDoc = audienceSessionDocSchema.parse({
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        projectId: input.projectId,
        clipKind: input.clipKind,
        createdAt: input.createdAt,
        closedAt: null,
        voterCount: 0,
        snapshotFrame: null,
        adapterDescriptor: input.adapterDescriptor,
        ttlAt: input.ttlAt,
      });
      await writeSessionDoc(doc);
      return doc;
    },

    async closeSession(input: CloseSessionInput): Promise<AudienceSessionDoc> {
      const existing = await readSessionDoc(input.sessionId);
      if (!existing) {
        throw new Error(`closeSession: sessionId ${input.sessionId} not found`);
      }
      if (existing.closedAt !== null) {
        return existing;
      }
      const updated: AudienceSessionDoc = audienceSessionDocSchema.parse({
        ...existing,
        closedAt: input.closedAt,
        snapshotFrame: input.snapshotFrame,
        ttlAt: input.ttlAt,
      });
      await writeSessionDoc(updated);
      return updated;
    },

    async appendEvent(input: AppendEventInput): Promise<AudienceEventDoc> {
      const existing = await readSessionDoc(input.sessionId);
      if (!existing) {
        throw new Error(`appendEvent: sessionId ${input.sessionId} not found`);
      }
      const voterTokenHash = hashVoterToken(pepper, input.voterToken);
      const eventDoc: AudienceEventDoc = audienceEventDocSchema.parse({
        eventId: input.eventId,
        sessionId: input.sessionId,
        voterTokenHash,
        serverTimestamp: input.serverTimestamp,
        clientTimestamp: input.clientTimestamp,
        payload: input.payload,
        accepted: input.accepted,
        ...(input.rejectReason !== undefined ? { rejectReason: input.rejectReason } : {}),
      });

      // Use eventId as the Firestore doc id → writes are idempotent.
      await eventsFor(input.sessionId)
        .doc(input.eventId)
        .set(
          compact({
            sessionId: eventDoc.sessionId,
            voterTokenHash: eventDoc.voterTokenHash,
            serverTimestamp: eventDoc.serverTimestamp,
            clientTimestamp: eventDoc.clientTimestamp,
            payload: eventDoc.payload,
            accepted: eventDoc.accepted,
            rejectReason: eventDoc.rejectReason,
          }),
        );

      // Bump voterCount on first-accepted-from-this-voter. The
      // "first-seen" check reads the events sub-collection filtered by
      // voterTokenHash; if the only matching row is the one we just
      // wrote, this is the voter's first accepted event.
      if (input.accepted) {
        const sameVoter = await eventsFor(input.sessionId)
          .where('voterTokenHash', '==', voterTokenHash)
          .where('accepted', '==', true)
          .limit(2)
          .get();
        const isFirstSeen = sameVoter.docs.length === 1;
        if (isFirstSeen) {
          const refreshed = await readSessionDoc(input.sessionId);
          if (refreshed) {
            await writeSessionDoc({ ...refreshed, voterCount: refreshed.voterCount + 1 });
          }
        }
      }

      return eventDoc;
    },

    async readSnapshot(sessionId: string): Promise<AudienceSessionDoc | null> {
      return readSessionDoc(sessionId);
    },

    async setTtl(sessionId: string, ttlAt: string): Promise<void> {
      const existing = await readSessionDoc(sessionId);
      if (!existing) {
        throw new Error(`setTtl: sessionId ${sessionId} not found`);
      }
      const next: AudienceSessionDoc = audienceSessionDocSchema.parse({ ...existing, ttlAt });
      await writeSessionDoc(next);
    },

    async updateQuizState(
      sessionId: string,
      mutator: (current: AudienceQuizState | undefined) => AudienceQuizState,
    ): Promise<AudienceQuizState> {
      // Read-modify-write race window: the structural shim is
      // single-threaded; production Firestore admits transactional
      // updates but this surface is invoked from a single presenter
      // session-state worker per session (per T-473's serialization
      // invariant), so the race is not observable in practice.
      const existing = await readSessionDoc(sessionId);
      if (!existing) {
        throw new Error(`updateQuizState: sessionId ${sessionId} not found`);
      }
      const nextState = audienceQuizStateSchema.parse(mutator(existing.quizState));
      const nextDoc: AudienceSessionDoc = audienceSessionDocSchema.parse({
        ...existing,
        quizState: nextState,
      });
      await writeSessionDoc(nextDoc);
      return nextState;
    },

    async listEvents(
      sessionId: string,
      opts?: ListEventsOptions,
    ): Promise<readonly AudienceEventDoc[]> {
      const limit = opts?.limit ?? 10000;
      let q: FirestoreQueryLike = eventsFor(sessionId).orderBy('serverTimestamp', 'asc');
      if (opts?.after !== undefined) {
        q = q.where('serverTimestamp', '>', opts.after);
      }
      q = q.limit(limit);
      const snap = await q.get();
      return snap.docs.map((d) => {
        const data = d.data() ?? {};
        return audienceEventDocSchema.parse({ ...data, eventId: d.id });
      });
    },
  };
}
