// packages/storage/src/audience-results-store.test.ts
// T-453 — Contract tests for `InMemoryAudienceResultsStore`. Covers:
// openSession idempotency; closeSession (open → close + reopen
// no-op + reject for unknown id); appendEvent hashing + voterCount
// bump-on-first-accepted; readSnapshot; setTtl; voter-token hashing
// pepper invariants (same pepper → same hash; different pepper →
// different hash).

import { describe, expect, it } from 'vitest';

import { InMemoryAudienceResultsStore, type OpenSessionInput } from './audience-results-store.js';

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
  return new InMemoryAudienceResultsStore({ pepper });
}

describe('InMemoryAudienceResultsStore — constructor', () => {
  it('rejects empty pepper', () => {
    expect(() => new InMemoryAudienceResultsStore({ pepper: '' })).toThrow(/pepper/);
  });
});

describe('InMemoryAudienceResultsStore — openSession', () => {
  it('opens a fresh session with closedAt: null + voterCount: 0', async () => {
    const store = makeStore();
    const doc = await store.openSession(baseOpenInput);
    expect(doc.closedAt).toBe(null);
    expect(doc.voterCount).toBe(0);
    expect(doc.snapshotFrame).toBe(null);
    expect(doc.clipKind).toBe('live-poll-multiple-choice');
  });

  it('is idempotent — same (tenantId, projectId, sessionId) returns the existing doc', async () => {
    const store = makeStore();
    const first = await store.openSession(baseOpenInput);
    const second = await store.openSession(baseOpenInput);
    expect(second).toEqual(first);
  });

  it('rejects an open with the same sessionId but a different tenant', async () => {
    const store = makeStore();
    await store.openSession(baseOpenInput);
    await expect(store.openSession({ ...baseOpenInput, tenantId: 'tenant-2' })).rejects.toThrow(
      /different tenant/,
    );
  });
});

describe('InMemoryAudienceResultsStore — closeSession', () => {
  it('closes an open session — sets closedAt + snapshotFrame + new ttlAt', async () => {
    const store = makeStore();
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
    const store = makeStore();
    await store.openSession(baseOpenInput);
    const first = await store.closeSession({
      sessionId: baseOpenInput.sessionId,
      closedAt: '2026-05-11T01:00:00.000Z',
      snapshotFrame: 1800,
      ttlAt: '2026-08-09T01:00:00.000Z',
    });
    const second = await store.closeSession({
      sessionId: baseOpenInput.sessionId,
      closedAt: '2026-05-11T02:00:00.000Z', // different, but no-op'd
      snapshotFrame: 9999,
      ttlAt: '2026-08-10T00:00:00.000Z',
    });
    expect(second).toEqual(first);
  });

  it('throws when the session does not exist', async () => {
    const store = makeStore();
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

describe('InMemoryAudienceResultsStore — appendEvent', () => {
  it('hashes the voter token at rest (never persists plaintext)', async () => {
    const store = makeStore();
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

  it('same plaintext + same pepper produces a stable hash across calls', async () => {
    const store = makeStore();
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

  it('different pepper → different hash for the same plaintext', async () => {
    const a = makeStore('pepper-one-pepper-one-pepper-one');
    const b = makeStore('pepper-two-pepper-two-pepper-two');
    expect(a.hashVoterToken('voter-1')).not.toBe(b.hashVoterToken('voter-1'));
  });

  it('bumps voterCount only on the first accepted event from a given voter', async () => {
    const store = makeStore();
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

    // Same voter, accepted again — no bump.
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
    const store = makeStore();
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
    const store = makeStore();
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
});

describe('InMemoryAudienceResultsStore — listEvents (T-459)', () => {
  async function seed(store: InMemoryAudienceResultsStore) {
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
    const store = makeStore();
    expect(await store.listEvents('unknown')).toEqual([]);
  });

  it('returns all events for a session ordered by serverTimestamp asc', async () => {
    const store = makeStore();
    await seed(store);
    const events = await store.listEvents(baseOpenInput.sessionId);
    expect(events.map((e) => e.eventId)).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });

  it('honours opts.after — returns only events strictly newer than the cursor', async () => {
    const store = makeStore();
    await seed(store);
    const events = await store.listEvents(baseOpenInput.sessionId, {
      after: '2026-05-11T00:00:01.000Z',
    });
    expect(events.map((e) => e.eventId)).toEqual(['evt-2', 'evt-3']);
  });

  it('honours opts.limit — caps the number of returned rows', async () => {
    const store = makeStore();
    await seed(store);
    const events = await store.listEvents(baseOpenInput.sessionId, { limit: 2 });
    expect(events.map((e) => e.eventId)).toEqual(['evt-1', 'evt-2']);
  });

  it('honours opts.after + opts.limit together (pagination)', async () => {
    const store = makeStore();
    await seed(store);
    const page1 = await store.listEvents(baseOpenInput.sessionId, { limit: 2 });
    expect(page1.map((e) => e.eventId)).toEqual(['evt-1', 'evt-2']);
    const page2 = await store.listEvents(baseOpenInput.sessionId, {
      limit: 2,
      after: page1.at(-1)?.serverTimestamp,
    });
    expect(page2.map((e) => e.eventId)).toEqual(['evt-3']);
  });

  it('default limit is 10000 (large session is returned in one call)', async () => {
    const store = makeStore();
    await store.openSession(baseOpenInput);
    // Append 50 events; default limit is well above this.
    for (let i = 0; i < 50; i++) {
      await store.appendEvent({
        sessionId: baseOpenInput.sessionId,
        eventId: `evt-${String(i).padStart(3, '0')}`,
        voterToken: `voter-${i}`,
        serverTimestamp: new Date(Date.UTC(2026, 4, 11, 0, 0, i)).toISOString(),
        clientTimestamp: new Date(Date.UTC(2026, 4, 11, 0, 0, i)).toISOString(),
        payload: {},
        accepted: true,
      });
    }
    const events = await store.listEvents(baseOpenInput.sessionId);
    expect(events).toHaveLength(50);
  });
});

describe('InMemoryAudienceResultsStore — updateQuizState (T-473)', () => {
  const liveQuizOpen: OpenSessionInput = {
    ...baseOpenInput,
    clipKind: 'live-quiz',
  };

  it('initializes quizState from undefined on first call', async () => {
    const store = makeStore();
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
    const store = makeStore();
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
    const store = makeStore();
    await expect(
      store.updateQuizState('unknown', () => ({
        activeQuestionIndex: 0,
        scores: {},
        joinedAt: {},
      })),
    ).rejects.toThrow(/not found/);
  });

  it('throws when the mutator returns an invalid shape (negative score)', async () => {
    const store = makeStore();
    await store.openSession(liveQuizOpen);
    await expect(
      store.updateQuizState(liveQuizOpen.sessionId, () => ({
        activeQuestionIndex: 0,
        scores: { 'voter-a': -1 },
        joinedAt: {},
      })),
    ).rejects.toThrow();
  });

  it('preserves the rest of the session doc (voterCount + adapterDescriptor)', async () => {
    const store = makeStore();
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

describe('InMemoryAudienceResultsStore — readSnapshot + setTtl', () => {
  it('returns null for an unknown session', async () => {
    const store = makeStore();
    expect(await store.readSnapshot('unknown')).toBe(null);
  });

  it('returns the current doc', async () => {
    const store = makeStore();
    const opened = await store.openSession(baseOpenInput);
    expect(await store.readSnapshot(baseOpenInput.sessionId)).toEqual(opened);
  });

  it('setTtl overrides ttlAt', async () => {
    const store = makeStore();
    await store.openSession(baseOpenInput);
    await store.setTtl(baseOpenInput.sessionId, '2027-01-01T00:00:00.000Z');
    const snap = await store.readSnapshot(baseOpenInput.sessionId);
    expect(snap?.ttlAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('setTtl throws when the session does not exist', async () => {
    const store = makeStore();
    await expect(store.setTtl('unknown', '2027-01-01T00:00:00.000Z')).rejects.toThrow(/not found/);
  });
});
