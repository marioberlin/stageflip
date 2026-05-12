// packages/audience-native/src/provider.test.ts
// Unit tests for `createAudienceNativeProvider` (T-478). Drives the
// provider through the standard `InMemoryAudienceResultsStore`
// (T-453) with an injected clock for deterministic assertions.

import { InMemoryAudienceResultsStore } from '@stageflip/storage';
import { describe, expect, it } from 'vitest';

import { audienceNativeDescriptor } from './descriptor.js';
import { createAudienceNativeProvider } from './provider.js';

const FIXED_NOW = Date.parse('2026-05-12T12:00:00.000Z');

function makeStore() {
  return new InMemoryAudienceResultsStore({ pepper: 't-478-test-pepper' });
}

function makeProvider() {
  return createAudienceNativeProvider({
    store: makeStore(),
    now: () => FIXED_NOW,
    subscribePollMs: 5,
  });
}

describe('createAudienceNativeProvider', () => {
  it('exposes the audienceNativeDescriptor fields', () => {
    const provider = makeProvider();
    expect(provider.id).toBe(audienceNativeDescriptor.id);
    expect(provider.modality.kind).toBe('audience-backend');
    expect(provider.capability.supportsMotionNative).toBe(true);
  });

  describe('openSession', () => {
    it('opens a new session and returns a SessionHandle with joinUrl + joinCode', async () => {
      const provider = makeProvider();
      const handle = await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: '01HXAUDIENCE0001',
        clipKind: 'live-poll-multiple-choice',
      });
      expect(handle.sessionId).toBe('01HXAUDIENCE0001');
      expect(handle.joinUrl).toBe('/v1/audience/join/01HXAUDIENCE0001');
      expect(handle.joinCode).toBe('01HXAU');
      expect(handle.closedAt).toBeUndefined();
    });

    it('idempotent — returns existing handle on repeated call', async () => {
      const provider = makeProvider();
      const a = await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: 'sess-x',
        clipKind: 'live-qa',
      });
      const b = await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: 'sess-x',
        clipKind: 'live-qa',
      });
      expect(b.sessionId).toBe(a.sessionId);
    });
  });

  describe('submitVote', () => {
    it('persists the event and returns an accepted VoteAck', async () => {
      const provider = makeProvider();
      await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: 'sess-v',
        clipKind: 'live-poll-multiple-choice',
      });
      const ack = await provider.submitVote({
        sessionId: 'sess-v',
        voterToken: 'voter-token-abc',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
        clientTimestamp: '2026-05-12T11:59:59.000Z',
      });
      expect(ack.accepted).toBe(true);
      expect(ack.eventId.length).toBeGreaterThan(0);
      expect(ack.serverTimestamp).toBe('2026-05-12T12:00:00.000Z');
    });
  });

  describe('closeSession', () => {
    it('returns FinalSnapshot with closedAt and snapshotFrame', async () => {
      const provider = makeProvider();
      await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: 'sess-c',
        clipKind: 'live-qa',
      });
      const final = await provider.closeSession({
        sessionId: 'sess-c',
        authToken: 'presenter-token',
      });
      expect(final.closedAt).toBe('2026-05-12T12:00:00.000Z');
      expect(final.sessionId).toBe('sess-c');
      expect(typeof final.snapshotFrame).toBe('number');
    });

    it('throws when session does not exist', async () => {
      const provider = makeProvider();
      await expect(
        provider.closeSession({ sessionId: 'never-opened', authToken: 't' }),
      ).rejects.toThrow(/session 'never-opened' not found/);
    });
  });

  describe('subscribe', () => {
    it('returns an AsyncIterable that closes when the session closes', async () => {
      const provider = makeProvider();
      await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: 'sess-s',
        clipKind: 'live-poll-multiple-choice',
      });
      // Close the session immediately so the iterator terminates on first
      // poll. (The first snapshot still yields before the closed-at check.)
      await provider.closeSession({ sessionId: 'sess-s', authToken: 't' });
      const it = provider.subscribe({ sessionId: 'sess-s', authToken: 't' });
      const seen: unknown[] = [];
      for await (const snap of it) {
        seen.push(snap);
        if (seen.length >= 2) break;
      }
      expect(seen.length).toBeGreaterThanOrEqual(1);
    });

    it('iterator returns immediately for unknown sessions', async () => {
      const provider = makeProvider();
      const it = provider.subscribe({ sessionId: 'never-opened', authToken: 't' });
      const seen: unknown[] = [];
      for await (const snap of it) seen.push(snap);
      expect(seen.length).toBe(0);
    });
  });
});
