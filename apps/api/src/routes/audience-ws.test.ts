// apps/api/src/routes/audience-ws.test.ts
// T-453 — Tests for the WebSocket multiplexer's pure layers:
//   - `authenticateHandshake` (presenter / voter / failure paths,
//     close codes 4001 / 4002)
//   - `ReconnectBudget` (6 attempts max, reset on clean close)
//   - `dispatchAudienceMessage` per inbound frame type
//     (vote / admin-command / unsupported / bad JSON)
//
// The I/O layer (`createAudienceWebSocketServer`) is exercised by the
// server-mount integration test in `server.test.ts`.

import { describe, expect, it, vi } from 'vitest';

import { InMemoryAudienceResultsStore } from '@stageflip/storage';

import { VoterRateLimiter } from './audience-rate-limit.js';
import {
  type DispatchDeps,
  ReconnectBudget,
  type ServerOutboundFrame,
  authenticateHandshake,
  buildSnapshotFrame,
  dispatchAudienceMessage,
} from './audience-ws.js';

function makeStore() {
  return new InMemoryAudienceResultsStore({ pepper: 'test-pepper-32-bytes-fixed-value-x' });
}

const SESSION_ID = '01J0AB3F8R3RTKZQ9X4HMRZQAY';

async function seedSession(store: InMemoryAudienceResultsStore) {
  await store.openSession({
    tenantId: 'tenant-a',
    projectId: 'p',
    sessionId: SESSION_ID,
    clipKind: 'live-poll-multiple-choice',
    adapterDescriptor: { id: 'audience-native', license: 'MIT' },
    createdAt: '2026-05-11T00:00:00.000Z',
    ttlAt: '2026-05-12T00:00:00.000Z',
  });
}

function makeDispatchHarness(
  store: InMemoryAudienceResultsStore,
  principalOverride?: DispatchDeps['principal'],
): {
  deps: DispatchDeps;
  sent: ServerOutboundFrame[];
  closes: Array<{ code: number; reason: string }>;
} {
  const sent: ServerOutboundFrame[] = [];
  const closes: Array<{ code: number; reason: string }> = [];
  const deps: DispatchDeps = {
    sessionId: SESSION_ID,
    principal: principalOverride ?? { kind: 'voter', voterToken: 'voter-1' },
    audienceResultsStore: store,
    voterRateLimiter: new VoterRateLimiter({ now: () => 1_000_000 }),
    now: () => '2026-05-11T00:00:01.000Z',
    mintEventId: () => 'evt-1',
    send: (f) => sent.push(f),
    closeWith: (code, reason) => closes.push({ code, reason }),
  };
  return { deps, sent, closes };
}

describe('ReconnectBudget', () => {
  it('admits the first 6 attempts; refuses the 7th', () => {
    const budget = new ReconnectBudget();
    for (let i = 0; i < 6; i++) {
      expect(budget.admitOrRefuse('voter-1')).toBe(true);
    }
    expect(budget.admitOrRefuse('voter-1')).toBe(false);
  });

  it('isolates per voter', () => {
    const budget = new ReconnectBudget();
    for (let i = 0; i < 6; i++) budget.admitOrRefuse('voter-1');
    expect(budget.admitOrRefuse('voter-1')).toBe(false);
    expect(budget.admitOrRefuse('voter-2')).toBe(true);
  });

  it('resets the counter on a clean close', () => {
    const budget = new ReconnectBudget();
    budget.admitOrRefuse('voter-1');
    budget.admitOrRefuse('voter-1');
    expect(budget.peek('voter-1')).toBe(2);
    budget.resetOnCleanClose('voter-1');
    expect(budget.peek('voter-1')).toBe(0);
  });
});

describe('authenticateHandshake', () => {
  const okPresenter = {
    verifyPresenterToken: vi.fn(async () => ({ principalId: 'alice', org: 'tenant-a' })),
    verifyVoterToken: vi.fn(async () => ({ ok: true })),
  };
  const rejectingPresenter = {
    verifyPresenterToken: vi.fn(async () => {
      throw new Error('bad token');
    }),
    verifyVoterToken: vi.fn(async () => ({ ok: true })),
  };
  const rejectingVoter = {
    verifyPresenterToken: vi.fn(async () => ({ principalId: 'alice', org: 'tenant-a' })),
    verifyVoterToken: vi.fn(async () => ({ ok: false })),
  };

  it('admits a valid presenter token (Authorization: Bearer …)', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake(
      { authorization: 'Bearer good-token' },
      okPresenter,
      budget,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.principal?.kind).toBe('presenter');
  });

  it('returns 4001 on a malformed Authorization header', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake(
      { authorization: 'Basic foo' },
      okPresenter,
      budget,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.closeCode).toBe(4001);
  });

  it('returns 4001 when the presenter token is rejected', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake(
      { authorization: 'Bearer bad' },
      rejectingPresenter,
      budget,
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.closeCode).toBe(4001);
  });

  it('admits a valid voter subprotocol token', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake({ subprotocol: 'voter-1' }, okPresenter, budget);
    expect(outcome.ok).toBe(true);
    expect(outcome.principal).toMatchObject({ kind: 'voter', voterToken: 'voter-1' });
  });

  it('returns 4001 on an empty voter subprotocol', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake({ subprotocol: '   ' }, okPresenter, budget);
    expect(outcome.ok).toBe(false);
    expect(outcome.closeCode).toBe(4001);
  });

  it('returns 4001 when voter token is rejected', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake({ subprotocol: 'voter-1' }, rejectingVoter, budget);
    expect(outcome.ok).toBe(false);
    expect(outcome.closeCode).toBe(4001);
  });

  it('returns 4001 when no auth header is present', async () => {
    const budget = new ReconnectBudget();
    const outcome = await authenticateHandshake({}, okPresenter, budget);
    expect(outcome.ok).toBe(false);
    expect(outcome.closeCode).toBe(4001);
  });

  it('returns 4002 when voter exceeds the reconnect budget', async () => {
    const budget = new ReconnectBudget();
    for (let i = 0; i < 6; i++) {
      await authenticateHandshake({ subprotocol: 'voter-1' }, okPresenter, budget);
    }
    const outcome = await authenticateHandshake({ subprotocol: 'voter-1' }, okPresenter, budget);
    expect(outcome.ok).toBe(false);
    expect(outcome.closeCode).toBe(4002);
  });
});

describe('dispatchAudienceMessage — vote frames', () => {
  it('appends a valid vote to the store', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent, closes } = makeDispatchHarness(store);
    const raw = JSON.stringify({
      type: 'vote',
      clientTimestamp: '2026-05-11T00:00:00.500Z',
      payload: { kind: 'live-poll-multiple-choice', optionIndex: 1 },
    });
    await dispatchAudienceMessage(raw, deps);
    expect(closes).toHaveLength(0);
    expect(sent).toHaveLength(0);
    const events = await store.listEvents(SESSION_ID);
    expect(events).toHaveLength(1);
    expect(events[0]?.accepted).toBe(true);
  });

  it('refuses a vote on a closed session — sends LF-AUDIENCE-SESSION-CLOSED + closes 4000', async () => {
    const store = makeStore();
    await seedSession(store);
    await store.closeSession({
      sessionId: SESSION_ID,
      closedAt: '2026-05-11T00:01:00.000Z',
      snapshotFrame: 0,
      ttlAt: '2026-08-09T00:00:00.000Z',
    });
    const { deps, sent, closes } = makeDispatchHarness(store);
    await dispatchAudienceMessage(
      JSON.stringify({
        type: 'vote',
        clientTimestamp: '2026-05-11T00:00:00.500Z',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: 1 },
      }),
      deps,
    );
    expect(sent[0]).toMatchObject({ code: 'LF-AUDIENCE-SESSION-CLOSED' });
    expect(closes[0]?.code).toBe(4000);
  });

  it('refuses a vote when the rate cap is hit — sends LF-AUDIENCE-VOTER-RATE-LIMITED', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent } = makeDispatchHarness(store);
    // T-458 — default voter limiter is 2 Hz / 4 burst; drain it.
    for (let i = 0; i < 4; i++) await deps.voterRateLimiter.tryConsume('voter-1');
    await dispatchAudienceMessage(
      JSON.stringify({
        type: 'vote',
        clientTimestamp: '2026-05-11T00:00:00.500Z',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: 1 },
      }),
      deps,
    );
    expect(sent[0]).toMatchObject({ code: 'LF-AUDIENCE-VOTER-RATE-LIMITED' });
  });

  it('reaction-stream override admits 10/s/voter (T-458)', async () => {
    const store = makeStore();
    // Open a reaction-stream session so the dispatcher reads kind = reaction-stream.
    await store.openSession({
      tenantId: 'tenant-a',
      projectId: 'p',
      sessionId: 'rs-1',
      clipKind: 'reaction-stream',
      adapterDescriptor: { id: 'audience-native', license: 'MIT' },
      createdAt: '2026-05-11T00:00:00.000Z',
      ttlAt: '2026-05-12T00:00:00.000Z',
    });
    const sent: ServerOutboundFrame[] = [];
    const closes: Array<{ code: number; reason: string }> = [];
    const limiter = new VoterRateLimiter({ now: () => 1_000_000 });
    limiter.setClipKindOverride('reaction-stream', 10);
    const deps: DispatchDeps = {
      sessionId: 'rs-1',
      principal: { kind: 'voter', voterToken: 'voter-rs' },
      audienceResultsStore: store,
      voterRateLimiter: limiter,
      now: () => '2026-05-11T00:00:01.000Z',
      mintEventId: () => 'evt-rs',
      send: (f) => sent.push(f),
      closeWith: (code, reason) => closes.push({ code, reason }),
    };
    // 10 votes — all admitted at the override 10 Hz / 20 burst.
    for (let i = 0; i < 10; i++) {
      await dispatchAudienceMessage(
        JSON.stringify({
          type: 'vote',
          clientTimestamp: '2026-05-11T00:00:00.500Z',
          payload: { kind: 'reaction-stream', emojiId: 'heart' },
        }),
        deps,
      );
    }
    // No error frames sent; events recorded.
    expect(sent.filter((f) => f.type === 'error')).toHaveLength(0);
    expect(closes).toHaveLength(0);
  });

  it('non-reaction kinds throttle at the default 2 Hz (T-458)', async () => {
    const store = makeStore();
    await seedSession(store); // live-poll-multiple-choice — default rate.
    const sent: ServerOutboundFrame[] = [];
    const limiter = new VoterRateLimiter({ now: () => 1_000_000 });
    limiter.setClipKindOverride('reaction-stream', 10);
    const deps: DispatchDeps = {
      sessionId: SESSION_ID,
      principal: { kind: 'voter', voterToken: 'voter-poll' },
      audienceResultsStore: store,
      voterRateLimiter: limiter,
      now: () => '2026-05-11T00:00:01.000Z',
      mintEventId: () => 'evt-x',
      send: (f) => sent.push(f),
      closeWith: () => undefined,
    };
    // 4 admitted (burst), 5th refused.
    for (let i = 0; i < 4; i++) {
      await dispatchAudienceMessage(
        JSON.stringify({
          type: 'vote',
          clientTimestamp: '2026-05-11T00:00:00.500Z',
          payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
        }),
        deps,
      );
    }
    await dispatchAudienceMessage(
      JSON.stringify({
        type: 'vote',
        clientTimestamp: '2026-05-11T00:00:00.500Z',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
      }),
      deps,
    );
    expect(sent[0]).toMatchObject({ code: 'LF-AUDIENCE-VOTER-RATE-LIMITED' });
  });

  it('refuses a vote from a presenter principal — UNAUTHORIZED + close 4001', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent, closes } = makeDispatchHarness(store, {
      kind: 'presenter',
      principalId: 'alice',
      org: 'tenant-a',
    });
    await dispatchAudienceMessage(
      JSON.stringify({
        type: 'vote',
        clientTimestamp: '2026-05-11T00:00:00.500Z',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: 1 },
      }),
      deps,
    );
    expect(sent[0]).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(closes[0]?.code).toBe(4001);
  });

  it('refuses an invalid vote payload — BAD-FRAME', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent } = makeDispatchHarness(store);
    await dispatchAudienceMessage(
      JSON.stringify({
        type: 'vote',
        clientTimestamp: '2026-05-11T00:00:00.500Z',
        payload: { kind: 'live-poll-multiple-choice' /* missing optionIndex */ },
      }),
      deps,
    );
    expect(sent[0]).toMatchObject({ code: 'BAD-FRAME' });
  });
});

describe('dispatchAudienceMessage — admin-command frames', () => {
  it('admits a presenter admin-command — sends a snapshot frame', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent, closes } = makeDispatchHarness(store, {
      kind: 'presenter',
      principalId: 'alice',
      org: 'tenant-a',
    });
    await dispatchAudienceMessage(JSON.stringify({ type: 'admin-command', command: 'open' }), deps);
    expect(closes).toHaveLength(0);
    expect(sent[0]?.type).toBe('snapshot');
  });

  it('refuses a voter-originated admin-command — UNAUTHORIZED + close 4001', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent, closes } = makeDispatchHarness(store, {
      kind: 'voter',
      voterToken: 'voter-1',
    });
    await dispatchAudienceMessage(
      JSON.stringify({ type: 'admin-command', command: 'close' }),
      deps,
    );
    expect(sent[0]).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(closes[0]?.code).toBe(4001);
  });
});

describe('dispatchAudienceMessage — bad frames', () => {
  it('returns BAD-FRAME on invalid JSON', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent } = makeDispatchHarness(store);
    await dispatchAudienceMessage('{not json', deps);
    expect(sent[0]).toMatchObject({ code: 'BAD-FRAME' });
  });

  it('returns BAD-FRAME on missing type discriminator', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent } = makeDispatchHarness(store);
    await dispatchAudienceMessage('{}', deps);
    expect(sent[0]).toMatchObject({ code: 'BAD-FRAME' });
  });

  it('returns BAD-FRAME on unsupported type', async () => {
    const store = makeStore();
    await seedSession(store);
    const { deps, sent } = makeDispatchHarness(store);
    await dispatchAudienceMessage(JSON.stringify({ type: 'whatever' }), deps);
    expect(sent[0]).toMatchObject({ code: 'BAD-FRAME' });
  });
});

describe('buildSnapshotFrame', () => {
  it('wraps a session doc into the wire format', async () => {
    const store = makeStore();
    await seedSession(store);
    const snap = await store.readSnapshot(SESSION_ID);
    if (!snap) throw new Error('seeded session missing');
    const frame = buildSnapshotFrame(snap, '2026-05-11T00:00:01.000Z');
    expect(frame.type).toBe('snapshot');
    expect(frame.serverTimestamp).toBe('2026-05-11T00:00:01.000Z');
    expect(frame.voterCount).toBe(0);
  });
});
