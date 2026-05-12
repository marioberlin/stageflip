// packages/audience-mentimeter/src/provider.test.ts
// Unit tests for createMentimeterAudienceProvider (T-479) stub-mode body.

import { describe, expect, it } from 'vitest';

import { audienceMentimeterDescriptor } from './descriptor.js';
import { NotYetImplementedError, createMentimeterAudienceProvider } from './provider.js';

const FIXED_NOW = Date.parse('2026-05-12T12:00:00.000Z');

function makeProvider() {
  return createMentimeterAudienceProvider({ now: () => FIXED_NOW });
}

describe('createMentimeterAudienceProvider (stub mode)', () => {
  it('exposes the audienceMentimeterDescriptor fields', () => {
    const provider = makeProvider();
    expect(provider.id).toBe(audienceMentimeterDescriptor.id);
    expect(provider.modality.kind).toBe('audience-backend');
    expect(provider.capability.supportsMotionNative).toBe(false);
  });

  describe('openSession', () => {
    it('returns a Mentimeter-style SessionHandle for supported clip kinds', async () => {
      const provider = makeProvider();
      const handle = await provider.openSession({
        tenantId: 'tenant-1',
        projectId: 'proj-1',
        sessionId: 'mentimeter-sess-1',
        clipKind: 'live-poll-multiple-choice',
      });
      expect(handle.sessionId).toBe('mentimeter-sess-1');
      expect(handle.joinUrl).toBe('https://app.mentimeter.com/join/mentimeter-sess-1');
      expect(handle.joinCode).toBe('MENTIM');
    });

    it('rejects unsupported motion-native clip kinds (heatmap)', async () => {
      const provider = makeProvider();
      await expect(
        provider.openSession({
          tenantId: 'tenant-1',
          projectId: 'proj-1',
          sessionId: 's',
          clipKind: 'heatmap',
        }),
      ).rejects.toThrow(/clipKind 'heatmap' not supported by Mentimeter/);
    });

    it('rejects reaction-stream', async () => {
      const provider = makeProvider();
      await expect(
        provider.openSession({
          tenantId: 'tenant-1',
          projectId: 'proj-1',
          sessionId: 's',
          clipKind: 'reaction-stream',
        }),
      ).rejects.toThrow(/not supported/);
    });

    it('rejects audience-ai-prompt', async () => {
      const provider = makeProvider();
      await expect(
        provider.openSession({
          tenantId: 'tenant-1',
          projectId: 'proj-1',
          sessionId: 's',
          clipKind: 'audience-ai-prompt',
        }),
      ).rejects.toThrow(/not supported/);
    });
  });

  describe('production mode', () => {
    it('throws NotYetImplementedError on openSession', async () => {
      const provider = createMentimeterAudienceProvider({ mode: 'production' });
      await expect(
        provider.openSession({
          tenantId: 't',
          projectId: 'p',
          sessionId: 's',
          clipKind: 'live-poll-multiple-choice',
        }),
      ).rejects.toThrow(NotYetImplementedError);
    });

    it('throws NotYetImplementedError on submitVote', async () => {
      const provider = createMentimeterAudienceProvider({ mode: 'production' });
      await expect(
        provider.submitVote({
          sessionId: 's',
          voterToken: 'v',
          payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
          clientTimestamp: '2026-05-12T00:00:00.000Z',
        }),
      ).rejects.toThrow(NotYetImplementedError);
    });

    it('throws NotYetImplementedError on closeSession', async () => {
      const provider = createMentimeterAudienceProvider({ mode: 'production' });
      await expect(provider.closeSession({ sessionId: 's', authToken: 't' })).rejects.toThrow(
        NotYetImplementedError,
      );
    });
  });

  describe('submitVote (stub mode)', () => {
    it('returns an accepted VoteAck with deterministic eventId', async () => {
      const provider = makeProvider();
      const ack = await provider.submitVote({
        sessionId: 's',
        voterToken: 'voter-abc',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
        clientTimestamp: '2026-05-12T11:59:59.000Z',
      });
      expect(ack.accepted).toBe(true);
      expect(ack.eventId.startsWith('mentimeter-evt-')).toBe(true);
      expect(ack.serverTimestamp).toBe('2026-05-12T12:00:00.000Z');
    });
  });

  describe('subscribe (stub mode)', () => {
    it('yields nothing and returns immediately', async () => {
      const provider = makeProvider();
      const it = provider.subscribe({ sessionId: 's', authToken: 't' });
      const seen: unknown[] = [];
      for await (const snap of it) seen.push(snap);
      expect(seen.length).toBe(0);
    });
  });

  describe('closeSession (stub mode)', () => {
    it('returns FinalSnapshot with closedAt and snapshotFrame', async () => {
      const provider = makeProvider();
      const final = await provider.closeSession({ sessionId: 's', authToken: 't' });
      expect(final.closedAt).toBe('2026-05-12T12:00:00.000Z');
      expect(final.snapshotFrame).toBe(0);
    });
  });
});
