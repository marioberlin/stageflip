// packages/presence/src/in-memory.test.ts
// AC #4–#9: in-memory PresenceAdapter behaviour.

import { describe, expect, it } from 'vitest';
import { InMemoryPresenceAdapter } from './in-memory.js';
import type { Presence } from './presence.js';

function makePresence(userId: string, lastSeenMs = 1_700_000_000_000): Presence {
  return {
    userId,
    color: '#3b82f6',
    lastSeenMs,
    cursor: { slideId: 's1', x: 1, y: 2 },
  };
}

/** Pull the next yielded snapshot from a subscribe iterator. */
async function nextSnapshot(
  iter: AsyncIterator<Map<string, Presence>>,
): Promise<Map<string, Presence>> {
  const r = await iter.next();
  if (r.done) throw new Error('iterator exhausted');
  return r.value;
}

describe('InMemoryPresenceAdapter', () => {
  // AC #4
  it('set then subscribe yields the user record', async () => {
    const adapter = new InMemoryPresenceAdapter();
    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    const p = makePresence('alice');
    await adapter.set('doc-1', 'alice', p);

    // First yield — current snapshot, possibly empty (immediate emit).
    let snap = await nextSnapshot(iter);
    if (snap.size === 0) snap = await nextSnapshot(iter);
    expect(snap.get('alice')).toEqual(p);
    ac.abort();
  });

  // AC #5
  it('multi-subscriber: a second subscriber sees both users', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await adapter.set('doc-1', 'alice', makePresence('alice'));
    await adapter.set('doc-1', 'bob', makePresence('bob'));

    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    const snap = await nextSnapshot(iter);
    expect(snap.size).toBe(2);
    expect(snap.has('alice')).toBe(true);
    expect(snap.has('bob')).toBe(true);
    ac.abort();
  });

  // AC #6
  it('remove deletes the user from the next yielded map', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await adapter.set('doc-1', 'alice', makePresence('alice'));

    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    await nextSnapshot(iter); // initial emit

    await adapter.remove('doc-1', 'alice');
    const after = await nextSnapshot(iter);
    expect(after.has('alice')).toBe(false);
    ac.abort();
  });

  // AC #7
  it('registerDisconnectCleanup removes user when subscribe signal aborts', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await adapter.set('doc-1', 'alice', makePresence('alice'));
    await adapter.registerDisconnectCleanup('doc-1', 'alice');

    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    await nextSnapshot(iter); // initial emit

    // Simulate socket drop.
    ac.abort();
    // Allow the abort handler microtasks to flush.
    await new Promise((r) => setTimeout(r, 0));

    // A fresh subscribe must show alice gone.
    const ac2 = new AbortController();
    const iter2 = adapter.subscribe('doc-1', { signal: ac2.signal })[Symbol.asyncIterator]();
    const snap = await nextSnapshot(iter2);
    expect(snap.has('alice')).toBe(false);
    ac2.abort();
  });

  // AC #8
  it('per-doc isolation: writes to docA do not appear in docB subscribe', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await adapter.set('docA', 'alice', makePresence('alice'));

    const ac = new AbortController();
    const iter = adapter.subscribe('docB', { signal: ac.signal })[Symbol.asyncIterator]();
    const snap = await nextSnapshot(iter);
    expect(snap.size).toBe(0);
    ac.abort();
  });

  // AC #9
  it('multi-subscriber fan-out: two consumers both receive every change', async () => {
    const adapter = new InMemoryPresenceAdapter();
    const ac1 = new AbortController();
    const ac2 = new AbortController();
    const iter1 = adapter.subscribe('doc-1', { signal: ac1.signal })[Symbol.asyncIterator]();
    const iter2 = adapter.subscribe('doc-1', { signal: ac2.signal })[Symbol.asyncIterator]();

    // initial empty emits
    await nextSnapshot(iter1);
    await nextSnapshot(iter2);

    await adapter.set('doc-1', 'alice', makePresence('alice'));
    const s1 = await nextSnapshot(iter1);
    const s2 = await nextSnapshot(iter2);
    expect(s1.has('alice')).toBe(true);
    expect(s2.has('alice')).toBe(true);

    await adapter.set('doc-1', 'bob', makePresence('bob'));
    const t1 = await nextSnapshot(iter1);
    const t2 = await nextSnapshot(iter2);
    expect(t1.has('bob')).toBe(true);
    expect(t2.has('bob')).toBe(true);

    ac1.abort();
    ac2.abort();
  });

  it('iterator return() runs cleanup and ends loop', async () => {
    const adapter = new InMemoryPresenceAdapter();
    const it = adapter.subscribe('doc-1')[Symbol.asyncIterator]();
    await it.next();
    const r = await (it.return?.() ?? Promise.resolve({ value: undefined, done: true }));
    expect(r.done).toBe(true);
    expect(adapter.subscriberCount('doc-1')).toBe(0);
  });

  it('remove on unknown user is a no-op', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await expect(adapter.remove('doc-1', 'nobody')).resolves.toBeUndefined();
  });

  it('reset clears all docs and closes subscribers', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await adapter.set('doc-1', 'alice', makePresence('alice'));
    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    await nextSnapshot(iter);
    adapter.reset();
    const r = await iter.next();
    expect(r.done).toBe(true);
  });

  it('registerDisconnectCleanup is idempotent', async () => {
    const adapter = new InMemoryPresenceAdapter();
    await adapter.registerDisconnectCleanup('doc-1', 'alice');
    await adapter.registerDisconnectCleanup('doc-1', 'alice');
    // No throw + no double-register; verified by exercising subscribe abort.
    await adapter.set('doc-1', 'alice', makePresence('alice'));
    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    await nextSnapshot(iter);
    ac.abort();
    await new Promise((r) => setTimeout(r, 0));
    const ac2 = new AbortController();
    const iter2 = adapter.subscribe('doc-1', { signal: ac2.signal })[Symbol.asyncIterator]();
    const snap = await nextSnapshot(iter2);
    expect(snap.has('alice')).toBe(false);
    ac2.abort();
  });
});
