// packages/storage/src/audience-results-store.ts
// T-453 — `AudienceResultsStore` contract interface + in-memory
// implementation per ADR-009 §D5. Mirrors the T-411a
// `TenantSettingsStore` pattern: a small, single-responsibility facet
// with one in-memory impl for tests + dev. The Firestore-backed impl
// lands in T-474 (`packages/storage-firebase`).
//
// Five methods:
//   - openSession   — idempotent; same (tenantId, projectId, sessionId)
//                     returns the existing doc when called twice
//   - closeSession  — sets closedAt + snapshotFrame + recomputes ttlAt
//   - appendEvent   — append-only write to events/; hashes voterToken
//   - readSnapshot  — most-recent session doc + voterCount + clipKind
//   - setTtl        — override ttlAt (used by tenant-retention sweep)
//
// Voter-token hashing: SHA-256(pepper + plaintext_token), hex-encoded.
// The pepper is injected at construction so tests use a fixed value;
// production wiring reads it from service config (env var).

import { createHash } from 'node:crypto';

import {
  type AudienceEventDoc,
  type AudienceSessionDoc,
  audienceEventDocSchema,
  audienceSessionDocSchema,
} from './audience-results.js';

/**
 * Input to `openSession`. The store is idempotent on
 * `(tenantId, projectId, sessionId)`; calling twice with the same triple
 * returns the existing doc unchanged (per ADR-009 §D2 idempotency invariant).
 */
export interface OpenSessionInput {
  readonly tenantId: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly clipKind: AudienceSessionDoc['clipKind'];
  readonly adapterDescriptor: AudienceSessionDoc['adapterDescriptor'];
  /** ISO 8601 timestamp at which the session opens. */
  readonly createdAt: string;
  /** ISO 8601 default TTL — typically createdAt + 24h (orphan sweep). */
  readonly ttlAt: string;
}

/**
 * Input to `closeSession`. Sets `closedAt`, `snapshotFrame` (the frame
 * number of the authoritative final aggregation snapshot per ADR-009 §D5),
 * and recomputes `ttlAt` to `closedAt + retentionDays`.
 */
export interface CloseSessionInput {
  readonly sessionId: string;
  readonly closedAt: string;
  readonly snapshotFrame: number;
  readonly ttlAt: string;
}

/**
 * Options to `listEvents`. Pagination is by `appendedAt` (the event's
 * `serverTimestamp`); `after` returns events strictly newer than the
 * supplied ISO 8601 cursor. T-459.
 */
export interface ListEventsOptions {
  /**
   * Maximum number of events to return. Default 10000. The export
   * endpoint pages through repeatedly until `listEvents` returns fewer
   * than `limit` rows.
   */
  readonly limit?: number;
  /**
   * Exclusive ISO 8601 cursor; only events with `serverTimestamp > after`
   * are returned. Omit to start from the beginning.
   */
  readonly after?: string;
}

/**
 * Input to `appendEvent`. The store hashes `voterToken` with the
 * configured pepper before persisting (ADR-009 §D5 hashing-at-rest).
 */
export interface AppendEventInput {
  readonly sessionId: string;
  readonly eventId: string;
  readonly voterToken: string;
  readonly serverTimestamp: string;
  readonly clientTimestamp: string;
  readonly payload: unknown;
  readonly accepted: boolean;
  readonly rejectReason?: string;
}

/**
 * Storage facet for audience-results. Concrete adapters
 * (`InMemoryAudienceResultsStore` here; `FirestoreAudienceResultsStore`
 * lands in T-474) implement this contract; the `apps/api` server picks
 * the adapter at boot.
 */
export interface AudienceResultsStore {
  /**
   * Open a session. Idempotent on `(tenantId, projectId, sessionId)`:
   * calling twice with the same triple returns the existing doc. Throws
   * if the triple matches an already-closed session.
   */
  openSession(input: OpenSessionInput): Promise<AudienceSessionDoc>;

  /**
   * Close a session. Throws if the session does not exist. Re-closing an
   * already-closed session is a no-op (returns the existing doc).
   */
  closeSession(input: CloseSessionInput): Promise<AudienceSessionDoc>;

  /**
   * Append an event to the `events/` sub-collection. The store hashes
   * `voterToken` before persisting; the returned `AudienceEventDoc` carries
   * `voterTokenHash` (never the plaintext). Bumps `voterCount` on the
   * parent session doc when the voter-token hash is unseen and
   * `accepted === true`.
   */
  appendEvent(input: AppendEventInput): Promise<AudienceEventDoc>;

  /**
   * Read the current session doc. Returns `null` if the session does not
   * exist.
   */
  readSnapshot(sessionId: string): Promise<AudienceSessionDoc | null>;

  /**
   * Override the TTL on a session doc (used by the orphan sweep + by the
   * tenant-retention policy update path). Throws if the session does not
   * exist.
   */
  setTtl(sessionId: string, ttlAt: string): Promise<void>;

  /**
   * List the events recorded against `sessionId` ordered by
   * `serverTimestamp` ascending. T-459 — used by the result-export
   * endpoint to assemble the CSV / JSON download.
   *
   * Returns `[]` for an unknown session (a permissive read; the export
   * endpoint already verifies the session exists via `readSnapshot`
   * before paging).
   *
   * Pagination is by ISO 8601 cursor:
   *   - `opts.after` (exclusive): only events with
   *     `serverTimestamp > after` are returned.
   *   - `opts.limit` (default 10000): caps the number of rows returned.
   *     The export endpoint pages until `listEvents` returns fewer than
   *     `limit` rows.
   *
   * The Firestore-backed implementation (T-474) reads the `events/`
   * sub-collection with the same pagination semantics.
   */
  listEvents(sessionId: string, opts?: ListEventsOptions): Promise<readonly AudienceEventDoc[]>;
}

/**
 * In-memory `AudienceResultsStore`. Single-process; rows live in two
 * maps (sessions + events). `reset()` clears both. The voter-token pepper
 * is injected at construction so tests can use a fixed value.
 */
export class InMemoryAudienceResultsStore implements AudienceResultsStore {
  private readonly sessions = new Map<string, AudienceSessionDoc>();
  private readonly events = new Map<string, AudienceEventDoc[]>();
  private readonly knownVoterHashes = new Map<string, Set<string>>();
  private readonly pepper: string;

  constructor(options: { readonly pepper: string }) {
    if (options.pepper.length === 0) {
      throw new Error('InMemoryAudienceResultsStore: pepper must be non-empty');
    }
    this.pepper = options.pepper;
  }

  /**
   * Compute `SHA-256(pepper + plaintext_token)` per ADR-009 §D5. Lower-case
   * hex so the format invariant in `audienceEventDocSchema` admits the
   * value.
   */
  hashVoterToken(plaintext: string): string {
    return createHash('sha256').update(this.pepper).update(plaintext).digest('hex');
  }

  async openSession(input: OpenSessionInput): Promise<AudienceSessionDoc> {
    const existing = this.sessions.get(input.sessionId);
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
    this.sessions.set(input.sessionId, doc);
    this.events.set(input.sessionId, []);
    this.knownVoterHashes.set(input.sessionId, new Set());
    return doc;
  }

  async closeSession(input: CloseSessionInput): Promise<AudienceSessionDoc> {
    const existing = this.sessions.get(input.sessionId);
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
    this.sessions.set(input.sessionId, updated);
    return updated;
  }

  async appendEvent(input: AppendEventInput): Promise<AudienceEventDoc> {
    const existing = this.sessions.get(input.sessionId);
    if (!existing) {
      throw new Error(`appendEvent: sessionId ${input.sessionId} not found`);
    }
    const voterTokenHash = this.hashVoterToken(input.voterToken);
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
    const list = this.events.get(input.sessionId);
    if (list) list.push(eventDoc);

    // Bump voterCount when a new voter is seen + accepted.
    if (input.accepted) {
      const seenSet = this.knownVoterHashes.get(input.sessionId);
      if (seenSet && !seenSet.has(voterTokenHash)) {
        seenSet.add(voterTokenHash);
        const next: AudienceSessionDoc = { ...existing, voterCount: existing.voterCount + 1 };
        this.sessions.set(input.sessionId, next);
      }
    }
    return eventDoc;
  }

  async readSnapshot(sessionId: string): Promise<AudienceSessionDoc | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async setTtl(sessionId: string, ttlAt: string): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new Error(`setTtl: sessionId ${sessionId} not found`);
    }
    const next: AudienceSessionDoc = audienceSessionDocSchema.parse({ ...existing, ttlAt });
    this.sessions.set(sessionId, next);
  }

  /**
   * T-459 — list events for a session ordered by `serverTimestamp`
   * ascending. Returns `[]` for an unknown session. Supports cursor-based
   * pagination via `opts.after` (exclusive ISO 8601) + `opts.limit`
   * (default 10000).
   */
  async listEvents(
    sessionId: string,
    opts?: ListEventsOptions,
  ): Promise<readonly AudienceEventDoc[]> {
    const stored = this.events.get(sessionId) ?? [];
    // Sort a defensive copy ascending by serverTimestamp; the in-memory
    // append path pushes in insertion order, but the contract is "sorted
    // ascending" so we sort to be explicit.
    const sorted = [...stored].sort((a, b) =>
      a.serverTimestamp < b.serverTimestamp ? -1 : a.serverTimestamp > b.serverTimestamp ? 1 : 0,
    );
    const after = opts?.after;
    const filtered = after !== undefined ? sorted.filter((e) => e.serverTimestamp > after) : sorted;
    const limit = opts?.limit ?? 10000;
    return filtered.slice(0, limit);
  }

  /** Test-only hook to clear all rows. */
  reset(): void {
    this.sessions.clear();
    this.events.clear();
    this.knownVoterHashes.clear();
  }
}
