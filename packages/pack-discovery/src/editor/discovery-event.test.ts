// packages/pack-discovery/src/editor/discovery-event.test.ts

import { describe, expect, it } from 'vitest';

import { type DiscoveryEventKind, makeDiscoveryEvent } from './discovery-event.js';

describe('makeDiscoveryEvent', () => {
  it('constructs an event for each of the four kinds', () => {
    const kinds: DiscoveryEventKind[] = ['impression', 'click', 'install', 'dismiss'];
    for (const kind of kinds) {
      const ev = makeDiscoveryEvent({ kind, packIdHash: 'abc', position: 0, nowMs: 0 });
      expect(ev.kind).toBe(kind);
    }
  });

  it('formats nowMs as an ISO-8601 timestamp', () => {
    const ev = makeDiscoveryEvent({
      kind: 'click',
      packIdHash: 'abc',
      position: 0,
      nowMs: 0,
    });
    expect(ev.atIso).toBe('1970-01-01T00:00:00.000Z');
  });

  it('preserves the position rank exactly', () => {
    const ev = makeDiscoveryEvent({
      kind: 'impression',
      packIdHash: 'abc',
      position: 7,
      nowMs: 0,
    });
    expect(ev.position).toBe(7);
  });

  it('preserves the packIdHash exactly', () => {
    const ev = makeDiscoveryEvent({
      kind: 'install',
      packIdHash: 'deadbeef1234',
      position: 0,
      nowMs: 0,
    });
    expect(ev.packIdHash).toBe('deadbeef1234');
  });

  it('omitting nowMs falls back to a real-time stamp (parseable ISO)', () => {
    const ev = makeDiscoveryEvent({ kind: 'dismiss', packIdHash: 'abc', position: 0 });
    expect(Number.isFinite(Date.parse(ev.atIso))).toBe(true);
  });
});
