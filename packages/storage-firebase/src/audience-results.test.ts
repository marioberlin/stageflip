// packages/storage-firebase/src/audience-results.test.ts
// T-474 — Adapter unit tests against an in-memory `FirestoreAudienceResultsLike`
// shim. Mirrors the in-memory adapter's test surface so cross-adapter
// parity is provable by name alignment (per the T-411a tenant-settings
// pattern). Covers openSession idempotency, closeSession (open → close
// + re-close no-op + reject for unknown id), appendEvent hashing +
// voterCount bump-on-first-accepted + idempotency on the same
// eventId, readSnapshot, setTtl, updateQuizState, and listEvents
// pagination.

import { beforeEach, describe, expect, it } from 'vitest';

import type { OpenSessionInput } from '@stageflip/storage';

import {
  type FirestoreAudienceResultsLike,
  type FirestoreCollectionRefLike,
  type FirestoreDocRefLike,
  type FirestoreDocSnapshotLike,
  type FirestoreQueryLike,
  type FirestoreQuerySnapshotLike,
  createFirebaseAudienceResultsStore,
} from './audience-results.js';

// ---------------------------------------------------------------------------
// In-memory Firestore shim
// ---------------------------------------------------------------------------

type DocRow = Record<string, unknown>;
type DocsMap = Map<string, DocRow>;

interface CollectionStore {
  docs: DocsMap;
  /** sub-collections keyed by `${docId}/${subPath}`. */
  sub: Map<string, CollectionStore>;
}

function makeCollectionStore(): CollectionStore {
  return { docs: new Map(), sub: new Map() };
}

interface QueryFilter {
  readonly field: string;
  readonly op: '>' | '>=' | '<' | '<=' | '==';
  readonly value: unknown;
}

interface QueryState {
  readonly orderBy?: { readonly field: string; readonly direction: 'asc' | 'desc' };
  readonly filters: readonly QueryFilter[];
  readonly limit?: number;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function applyFilter(row: DocRow, f: QueryFilter): boolean {
  const v = row[f.field];
  switch (f.op) {
    case '==':
      return v === f.value;
    case '>':
      return compareValues(v, f.value) > 0;
    case '>=':
      return compareValues(v, f.value) >= 0;
    case '<':
      return compareValues(v, f.value) < 0;
    case '<=':
      return compareValues(v, f.value) <= 0;
  }
}

function buildQuery(store: CollectionStore, state: QueryState): FirestoreQueryLike {
  const run = async (): Promise<FirestoreQuerySnapshotLike> => {
    let entries = Array.from(store.docs.entries());
    for (const f of state.filters) {
      entries = entries.filter(([, row]) => applyFilter(row, f));
    }
    if (state.orderBy) {
      const { field, direction } = state.orderBy;
      entries.sort(([, a], [, b]) => {
        const cmp = compareValues(a[field], b[field]);
        return direction === 'asc' ? cmp : -cmp;
      });
    } else {
      entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    }
    if (state.limit !== undefined) entries = entries.slice(0, state.limit);
    return {
      docs: entries.map(([id, data]) => ({ id, data: () => ({ ...data }) })),
    };
  };

  return {
    orderBy(field, direction = 'asc') {
      return buildQuery(store, { ...state, orderBy: { field, direction } });
    },
    where(field, op, value) {
      return buildQuery(store, {
        ...state,
        filters: [...state.filters, { field, op, value }],
      });
    },
    limit(n) {
      return buildQuery(store, { ...state, limit: n });
    },
    get: run,
  };
}

function buildDocRef(store: CollectionStore, id: string): FirestoreDocRefLike {
  return {
    async get(): Promise<FirestoreDocSnapshotLike> {
      const data = store.docs.get(id);
      return {
        exists: data !== undefined,
        data: () => (data === undefined ? undefined : { ...data }),
      };
    },
    async set(payload) {
      store.docs.set(id, { ...payload });
      return undefined;
    },
    collection(subPath: string): FirestoreCollectionRefLike {
      const key = `${id}/${subPath}`;
      let sub = store.sub.get(key);
      if (!sub) {
        sub = makeCollectionStore();
        store.sub.set(key, sub);
      }
      return buildCollectionRef(sub);
    },
  };
}

function buildCollectionRef(store: CollectionStore): FirestoreCollectionRefLike {
  const q = buildQuery(store, { filters: [] });
  return {
    doc(id: string) {
      return buildDocRef(store, id);
    },
    orderBy: q.orderBy,
    where: q.where,
    limit: q.limit,
    get: q.get,
  };
}

function memoryFirestore(): FirestoreAudienceResultsLike {
  const collections = new Map<string, CollectionStore>();
  return {
    collection(name: string): FirestoreCollectionRefLike {
      let store = collections.get(name);
      if (!store) {
        store = makeCollectionStore();
        collections.set(name, store);
      }
      return buildCollectionRef(store);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const baseOpenInput: OpenSessionInput = {
  tenantId: 'tenant-1',
  projectId: 'project-1',
  sessionId: '01J0AB3F8R3RTKZQ9X4HMRZQAY',
  clipKind: 'live-poll-multiple-choice',
  adapterDescriptor: { id: 'audience-native', license: 'MIT' },
  createdAt: '2026-05-11T00:00:00.000Z',
  ttlAt: '2026-05-12T00:00:00.000Z',
};

function makeStore(pepper = 'test-pepper-32-bytes-fixed-value-x') {
  return createFirebaseAudienceResultsStore({
    firestore: memoryFirestore(),
    pepper,
  });
}

describe('createFirebaseAudienceResultsStore — factory guards', () => {
  it('rejects an empty pepper', () => {
    expect(() =>
      createFirebaseAudienceResultsStore({ firestore: memoryFirestore(), pepper: '' }),
    ).toThrow(/pepper/);
  });
});

describe('FirebaseAudienceResultsStore — openSession', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('opens a fresh session with closedAt: null + voterCount: 0', async () => {
    const doc = await store.openSession(baseOpenInput);
    expect(doc.closedAt).toBe(null);
    expect(doc.voterCount).toBe(0);
    expect(doc.snapshotFrame).toBe(null);
    expect(doc.clipKind).toBe('live-poll-multiple-choice');
  });

  it('is idempotent — same (tenantId, projectId, sessionId) returns the existing doc', async () => {
    const first = await store.openSession(baseOpenInput);
    const second = await store.openSession(baseOpenInput);
    expect(second).toEqual(first);
  });

  it('rejects an open with the same sessionId but a different tenant', async () => {
    await store.openSession(baseOpenInput);
    await expect(store.openSession({ ...baseOpenInput, tenantId: 'tenant-2' })).rejects.toThrow(
      /different tenant/,
    );
  });

  it('round-trips through Firestore — readSnapshot returns the persisted doc', async () => {
    const opened = await store.openSession(baseOpenInput);
    const snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap).toEqual(opened);
  });
});

describe('FirebaseAudienceResultsStore — closeSession', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('closes an open session — sets closedAt + snapshotFrame + new ttlAt', async () => {
    await store.openSession(baseOpenInput);
    const closed = await store.closeSession({
      sessionId: baseOpenInput.sessionId,
      closedAt: '2026-05-11T01:00:00.000Z',
      snapshotFrame: 1800,
      ttlAt: '2026-08-09T01:00:00.000Z',
    });
    expect(closed.closedAt).toBe('2026-05-11T01:00:00.000Z');
    expect(closed.snapshotFrame).toBe(1800);
    expect(closed.ttlAt).toBe('2026-08-09T01:00:00.000Z');
  });

  it('returns the existing doc when called twice on the same session (no-op)', async () => {
    await store.openSession(baseOpenInput);
    const first = await store.closeSession({
      sessionId: baseOpenInput.sessionId,
      closedAt: '2026-05-11T01:00:00.000Z',
      snapshotFrame: 1800,
      ttlAt: '2026-08-09T01:00:00.000Z',
    });
    const second = await store.closeSession({
      sessionId: baseOpenInput.sessionId,
      closedAt: '2026-05-11T02:00:00.000Z',
      snapshotFrame: 9999,
      ttlAt: '2026-08-10T00:00:00.000Z',
    });
    expect(second).toEqual(first);
  });

  it('throws when the session does not exist', async () => {
    await expect(
      store.closeSession({
        sessionId: 'unknown',
        closedAt: '2026-05-11T01:00:00.000Z',
        snapshotFrame: 0,
        ttlAt: '2026-08-09T01:00:00.000Z',
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe('FirebaseAudienceResultsStore — appendEvent', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('hashes the voter token at rest (never persists plaintext)', async () => {
    await store.openSession(baseOpenInput);
    const event = await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: '01J0AB3F8R3RTKZQ9X4HMRZQB0',
      voterToken: 'plaintext-token',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
      accepted: true,
    });
    expect(event.voterTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(event.voterTokenHash).not.toContain('plaintext-token');
  });

  it('stable hash across calls (same pepper + same plaintext)', async () => {
    await store.openSession(baseOpenInput);
    const a = await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-a',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: {},
      accepted: true,
    });
    const b = await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-b',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:02.000Z',
      clientTimestamp: '2026-05-11T00:00:01.500Z',
      payload: {},
      accepted: true,
    });
    expect(b.voterTokenHash).toBe(a.voterTokenHash);
  });

  it('bumps voterCount only on the first accepted event from a given voter', async () => {
    await store.openSession(baseOpenInput);
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-a',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: {},
      accepted: true,
    });
    let snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap?.voterCount).toBe(1);

    // Same voter again — no bump.
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-b',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:02.000Z',
      clientTimestamp: '2026-05-11T00:00:01.500Z',
      payload: {},
      accepted: true,
    });
    snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap?.voterCount).toBe(1);

    // New voter — bumps.
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-c',
      voterToken: 'voter-2',
      serverTimestamp: '2026-05-11T00:00:03.000Z',
      clientTimestamp: '2026-05-11T00:00:02.500Z',
      payload: {},
      accepted: true,
    });
    snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap?.voterCount).toBe(2);
  });

  it('does NOT bump voterCount on a rejected event', async () => {
    await store.openSession(baseOpenInput);
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-a',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: {},
      accepted: false,
      rejectReason: 'rate-limited',
    });
    const snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap?.voterCount).toBe(0);
  });

  it('throws when the session does not exist', async () => {
    await expect(
      store.appendEvent({
        sessionId: 'unknown',
        eventId: 'evt-a',
        voterToken: 'voter-1',
        serverTimestamp: '2026-05-11T00:00:01.000Z',
        clientTimestamp: '2026-05-11T00:00:00.500Z',
        payload: {},
        accepted: true,
      }),
    ).rejects.toThrow(/not found/);
  });

  it('is idempotent on eventId — re-writing the same eventId overwrites the existing row', async () => {
    await store.openSession(baseOpenInput);
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-a',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: {},
      accepted: true,
    });
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-a',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: {},
      accepted: true,
    });
    const events = await store.listEvents(baseOpenInput.sessionId);
    expect(events).toHaveLength(1);
  });
});

describe('FirebaseAudienceResultsStore — listEvents', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  async function seed() {
    await store.openSession(baseOpenInput);
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-1',
      voterToken: 'voter-a',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
      accepted: true,
    });
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-2',
      voterToken: 'voter-b',
      serverTimestamp: '2026-05-11T00:00:02.000Z',
      clientTimestamp: '2026-05-11T00:00:01.500Z',
      payload: { kind: 'live-poll-multiple-choice', optionIndex: 1 },
      accepted: true,
    });
    await store.appendEvent({
      sessionId: baseOpenInput.sessionId,
      eventId: 'evt-3',
      voterToken: 'voter-c',
      serverTimestamp: '2026-05-11T00:00:03.000Z',
      clientTimestamp: '2026-05-11T00:00:02.500Z',
      payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
      accepted: true,
    });
  }

  it('returns [] for an unknown session', async () => {
    expect(await store.listEvents('unknown')).toEqual([]);
  });

  it('returns all events ordered by serverTimestamp asc', async () => {
    await seed();
    const events = await store.listEvents(baseOpenInput.sessionId);
    expect(events.map((e) => e.eventId)).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });

  it('honours opts.after', async () => {
    await seed();
    const events = await store.listEvents(baseOpenInput.sessionId, {
      after: '2026-05-11T00:00:01.000Z',
    });
    expect(events.map((e) => e.eventId)).toEqual(['evt-2', 'evt-3']);
  });

  it('honours opts.limit', async () => {
    await seed();
    const events = await store.listEvents(baseOpenInput.sessionId, { limit: 2 });
    expect(events.map((e) => e.eventId)).toEqual(['evt-1', 'evt-2']);
  });

  it('honours opts.after + opts.limit (pagination)', async () => {
    await seed();
    const page1 = await store.listEvents(baseOpenInput.sessionId, { limit: 2 });
    expect(page1.map((e) => e.eventId)).toEqual(['evt-1', 'evt-2']);
    const page2 = await store.listEvents(baseOpenInput.sessionId, {
      limit: 2,
      after: page1.at(-1)?.serverTimestamp,
    });
    expect(page2.map((e) => e.eventId)).toEqual(['evt-3']);
  });
});

describe('FirebaseAudienceResultsStore — readSnapshot + setTtl', () => {
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('returns null for an unknown session', async () => {
    expect(await store.readSnapshot('unknown')).toBe(null);
  });

  it('setTtl overrides ttlAt on the persisted doc', async () => {
    await store.openSession(baseOpenInput);
    await store.setTtl(baseOpenInput.sessionId, '2027-01-01T00:00:00.000Z');
    const snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap?.ttlAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('setTtl throws when the session does not exist', async () => {
    await expect(store.setTtl('unknown', '2027-01-01T00:00:00.000Z')).rejects.toThrow(/not found/);
  });
});

describe('FirebaseAudienceResultsStore — updateQuizState', () => {
  const liveQuizOpen: OpenSessionInput = {
    ...baseOpenInput,
    clipKind: 'live-quiz',
  };
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => {
    store = makeStore();
  });

  it('initializes quizState from undefined on first call', async () => {
    await store.openSession(liveQuizOpen);
    const result = await store.updateQuizState(liveQuizOpen.sessionId, (current) => {
      expect(current).toBeUndefined();
      return { activeQuestionIndex: 0, scores: {}, joinedAt: {} };
    });
    expect(result).toEqual({ activeQuestionIndex: 0, scores: {}, joinedAt: {} });
    const snap = await store.readSnapshot(liveQuizOpen.sessionId);
    expect(snap?.quizState).toEqual({ activeQuestionIndex: 0, scores: {}, joinedAt: {} });
  });

  it('mutates the existing state across multiple calls', async () => {
    await store.openSession(liveQuizOpen);
    await store.updateQuizState(liveQuizOpen.sessionId, () => ({
      activeQuestionIndex: 0,
      scores: { 'voter-a': 1000 },
      joinedAt: { 'voter-a': 0 },
    }));
    const second = await store.updateQuizState(liveQuizOpen.sessionId, (current) => {
      expect(current).toEqual({
        activeQuestionIndex: 0,
        scores: { 'voter-a': 1000 },
        joinedAt: { 'voter-a': 0 },
      });
      return {
        activeQuestionIndex: 1,
        scores: { 'voter-a': 1750 },
        joinedAt: { 'voter-a': 0 },
      };
    });
    expect(second).toEqual({
      activeQuestionIndex: 1,
      scores: { 'voter-a': 1750 },
      joinedAt: { 'voter-a': 0 },
    });
  });

  it('throws if the session does not exist', async () => {
    await expect(
      store.updateQuizState('unknown', () => ({
        activeQuestionIndex: 0,
        scores: {},
        joinedAt: {},
      })),
    ).rejects.toThrow(/not found/);
  });

  it('throws when the mutator returns an invalid shape (negative score)', async () => {
    await store.openSession(liveQuizOpen);
    await expect(
      store.updateQuizState(liveQuizOpen.sessionId, () => ({
        activeQuestionIndex: 0,
        scores: { 'voter-a': -1 },
        joinedAt: {},
      })),
    ).rejects.toThrow();
  });

  it('preserves voterCount + adapterDescriptor across the update', async () => {
    await store.openSession(liveQuizOpen);
    await store.appendEvent({
      sessionId: liveQuizOpen.sessionId,
      eventId: 'evt-x',
      voterToken: 'voter-1',
      serverTimestamp: '2026-05-11T00:00:01.000Z',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: { kind: 'live-quiz', questionId: 'q1', optionIndex: 0 },
      accepted: true,
    });
    await store.updateQuizState(liveQuizOpen.sessionId, () => ({
      activeQuestionIndex: 0,
      scores: { 'voter-hash-a': 500 },
      joinedAt: { 'voter-hash-a': 0 },
    }));
    const snap = await store.readSnapshot(liveQuizOpen.sessionId);
    expect(snap?.voterCount).toBe(1);
    expect(snap?.adapterDescriptor).toEqual(liveQuizOpen.adapterDescriptor);
    expect(snap?.clipKind).toBe('live-quiz');
  });
});
