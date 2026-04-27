// packages/presence/src/client.test.ts
// AC #15–#22: PresenceClient behaviour. Uses the InMemoryPresenceAdapter
// plus injectable timer/clock impls so the tests are deterministic without
// vitest fake-timers (the async iterator pattern composes poorly with
// vi.useFakeTimers when the adapter does its own queueing).

import { describe, expect, it } from 'vitest';
import { PresenceClient } from './client.js';
import { InMemoryPresenceAdapter } from './in-memory.js';
import type { Presence } from './presence.js';

interface ManualTimer {
  handle: number;
  ms: number;
  cb: () => void;
  fired: boolean;
  cleared: boolean;
  kind: 'timeout' | 'interval';
  scheduledAt: number;
}

/** Tiny manual timer harness: nothing fires until `advanceTo()` says so. */
class TimerHarness {
  private nowMs = 0;
  private nextHandle = 1;
  private timers: ManualTimer[] = [];

  now(): number {
    return this.nowMs;
  }

  setTimeout = (cb: () => void, ms: number): unknown => {
    const handle = this.nextHandle++;
    this.timers.push({
      handle,
      ms,
      cb,
      fired: false,
      cleared: false,
      kind: 'timeout',
      scheduledAt: this.nowMs,
    });
    return handle;
  };

  clearTimeout = (h: unknown): void => {
    const t = this.timers.find((tt) => tt.handle === h);
    if (t) t.cleared = true;
  };

  setInterval = (cb: () => void, ms: number): unknown => {
    const handle = this.nextHandle++;
    this.timers.push({
      handle,
      ms,
      cb,
      fired: false,
      cleared: false,
      kind: 'interval',
      scheduledAt: this.nowMs,
    });
    return handle;
  };

  clearInterval = (h: unknown): void => {
    const t = this.timers.find((tt) => tt.handle === h);
    if (t) t.cleared = true;
  };

  /** Advance to absolute time and fire all due timers (in order). */
  async advanceTo(target: number): Promise<void> {
    while (true) {
      // Find the earliest unfired/uncleared due timer.
      const due = this.timers
        .filter((t) => !t.cleared)
        .filter((t) => {
          if (t.kind === 'timeout') return !t.fired && t.scheduledAt + t.ms <= target;
          // interval: next fire at scheduledAt + n*ms; we step one fire at a time
          return t.scheduledAt + t.ms <= target;
        })
        .sort((a, b) => a.scheduledAt + a.ms - (b.scheduledAt + b.ms))[0];
      if (!due) break;
      const fireAt = due.scheduledAt + due.ms;
      this.nowMs = fireAt;
      if (due.kind === 'timeout') {
        due.fired = true;
        due.cb();
      } else {
        // Reschedule for next tick by bumping scheduledAt to fireAt.
        due.scheduledAt = fireAt;
        due.cb();
      }
      // Yield to microtasks so any awaited adapter writes settle.
      await Promise.resolve();
      await Promise.resolve();
    }
    this.nowMs = target;
  }
}

function harness(): {
  adapter: InMemoryPresenceAdapter;
  timer: TimerHarness;
  client: PresenceClient;
} {
  const adapter = new InMemoryPresenceAdapter();
  const timer = new TimerHarness();
  const client = new PresenceClient({
    adapter,
    docId: 'doc-1',
    userId: 'alice',
    setIntervalImpl: timer.setInterval,
    clearIntervalImpl: timer.clearInterval,
    setTimeoutImpl: timer.setTimeout,
    clearTimeoutImpl: timer.clearTimeout,
    now: () => timer.now(),
  });
  return { adapter, timer, client };
}

async function nextSnap(
  iter: AsyncIterator<Map<string, Presence>>,
): Promise<Map<string, Presence>> {
  const r = await iter.next();
  if (r.done) throw new Error('iterator exhausted');
  return r.value;
}

describe('PresenceClient', () => {
  // AC #15
  it('connect writes the first record and registers disconnect cleanup', async () => {
    const { adapter, client } = harness();
    let writeSeen = false;
    let disconnectSeen = false;
    const origSet = adapter.set.bind(adapter);
    const origRegister = adapter.registerDisconnectCleanup.bind(adapter);
    adapter.set = async (...args) => {
      writeSeen = true;
      return origSet(...args);
    };
    adapter.registerDisconnectCleanup = async (...args) => {
      disconnectSeen = true;
      return origRegister(...args);
    };

    await client.connect();
    expect(writeSeen).toBe(true);
    expect(disconnectSeen).toBe(true);
    await client.dispose();
  });

  // AC #16 — debounce wire vs local
  it('setCursor debounces wire writes to 50 ms; local listener fires every call', async () => {
    const { adapter, timer, client } = harness();
    await client.connect();

    let wireWrites = 0;
    const origSet = adapter.set.bind(adapter);
    adapter.set = async (...args) => {
      wireWrites += 1;
      return origSet(...args);
    };

    let localFired = 0;
    client.onLocal(() => {
      localFired += 1;
    });

    // 10 setCursor calls within 50 ms.
    for (let i = 0; i < 10; i += 1) {
      client.setCursor({ slideId: 's1', x: i, y: i });
    }
    expect(localFired).toBe(10);
    // Before debounce window elapses: zero wire writes.
    expect(wireWrites).toBe(0);

    // Advance past 50 ms — exactly one wire write.
    await timer.advanceTo(timer.now() + 60);
    expect(wireWrites).toBe(1);

    await client.dispose();
  });

  // AC #17 — selection NOT debounced
  it('setSelection writes through every call (no debounce)', async () => {
    const { adapter, client } = harness();
    await client.connect();

    let wireWrites = 0;
    const origSet = adapter.set.bind(adapter);
    adapter.set = async (...args) => {
      wireWrites += 1;
      return origSet(...args);
    };

    await client.setSelection({ elementIds: ['e1'] });
    await client.setSelection({ elementIds: ['e1', 'e2'] });
    await client.setSelection({ elementIds: [] });

    expect(wireWrites).toBe(3);
    await client.dispose();
  });

  // AC #18 — subscribe excludes the local user
  it('subscribe excludes the local user (peers only)', async () => {
    const { adapter, client } = harness();
    await client.connect();

    // Pre-seed a peer.
    await adapter.set('doc-1', 'bob', {
      userId: 'bob',
      color: '#10b981',
      lastSeenMs: 0,
    });

    const it = client.subscribe()[Symbol.asyncIterator]();
    const snap = await nextSnap(it);
    expect(snap.has('alice')).toBe(false);
    expect(snap.has('bob')).toBe(true);

    await it.return?.();
    await client.dispose();
  });

  // AC #19 — heartbeat
  it('heartbeat fires every 10 s; 35 s elapsed → 3 ticks', async () => {
    const { adapter, timer, client } = harness();
    await client.connect();
    const initialWrites = 1; // connect's first set

    let wireWrites = 0;
    const origSet = adapter.set.bind(adapter);
    adapter.set = async (...args) => {
      wireWrites += 1;
      return origSet(...args);
    };

    await timer.advanceTo(35_000);
    expect(wireWrites).toBe(3);
    expect(initialWrites).toBe(1); // sanity
    await client.dispose();
  });

  // AC #20 — idle/away transitions
  it('with no input for 30 s → idle; for 5 min → away', async () => {
    const { timer, client } = harness();
    await client.connect();
    expect(client.local.status).toBe('active');

    // Heartbeat fires at 10s, 20s, 30s — at 30s the idle threshold trips.
    await timer.advanceTo(30_000);
    expect(client.local.status).toBe('idle');

    // Push to 5 min — away threshold.
    await timer.advanceTo(5 * 60_000);
    expect(client.local.status).toBe('away');

    // Input resets to active.
    client.setCursor({ slideId: 's1', x: 0, y: 0 });
    expect(client.local.status).toBe('active');

    await client.dispose();
  });

  it('idle resets to active on setSelection', async () => {
    const { timer, client } = harness();
    await client.connect();
    await timer.advanceTo(30_000);
    expect(client.local.status).toBe('idle');
    await client.setSelection({ elementIds: ['x'] });
    expect(client.local.status).toBe('active');
    await client.dispose();
  });

  // AC #21 — dispose idempotent + cancels everything
  it('dispose cancels heartbeat, removes record, aborts subscribe; idempotent', async () => {
    const { adapter, client } = harness();
    await client.connect();
    expect(adapter.subscriberCount('doc-1')).toBe(0);

    const it = client.subscribe()[Symbol.asyncIterator]();
    await nextSnap(it);
    expect(adapter.subscriberCount('doc-1')).toBe(1);

    let removed = false;
    const origRemove = adapter.remove.bind(adapter);
    adapter.remove = async (...args) => {
      removed = true;
      return origRemove(...args);
    };

    await client.dispose();
    expect(removed).toBe(true);
    // Iterator finishes.
    const r = await it.next();
    expect(r.done).toBe(true);

    // Idempotent.
    await client.dispose();
  });

  // AC #22 — color
  it('color defaults to colorForUserId(userId)', () => {
    const adapter = new InMemoryPresenceAdapter();
    const client = new PresenceClient({ adapter, docId: 'd', userId: 'alice' });
    expect(client.color).toBe('#3b82f6');
  });

  it('color override is used as-is', () => {
    const adapter = new InMemoryPresenceAdapter();
    const client = new PresenceClient({
      adapter,
      docId: 'd',
      userId: 'alice',
      color: '#ff0000',
    });
    expect(client.color).toBe('#ff0000');
  });

  it('setCursor before connect updates local but does not write', async () => {
    const { adapter, client } = harness();
    let wireWrites = 0;
    const origSet = adapter.set.bind(adapter);
    adapter.set = async (...args) => {
      wireWrites += 1;
      return origSet(...args);
    };
    client.setCursor({ slideId: 's1', x: 1, y: 2 });
    expect(client.local.cursor).toEqual({ slideId: 's1', x: 1, y: 2 });
    expect(wireWrites).toBe(0);
    await client.dispose();
  });

  it('connect twice is a no-op', async () => {
    const { adapter, client } = harness();
    let writes = 0;
    const origSet = adapter.set.bind(adapter);
    adapter.set = async (...args) => {
      writes += 1;
      return origSet(...args);
    };
    await client.connect();
    await client.connect();
    expect(writes).toBe(1);
    await client.dispose();
  });

  it('connect after dispose throws', async () => {
    const adapter = new InMemoryPresenceAdapter();
    const client = new PresenceClient({ adapter, docId: 'd', userId: 'alice' });
    await client.dispose();
    await expect(client.connect()).rejects.toThrow('disposed');
  });

  it('subscribe after dispose throws', async () => {
    const adapter = new InMemoryPresenceAdapter();
    const client = new PresenceClient({ adapter, docId: 'd', userId: 'alice' });
    await client.dispose();
    expect(() => client.subscribe()).toThrow('disposed');
  });

  it('local listener unsubscribe stops receiving updates', async () => {
    const { client } = harness();
    await client.connect();
    let count = 0;
    const off = client.onLocal(() => {
      count += 1;
    });
    client.setCursor({ slideId: 's1', x: 0, y: 0 });
    expect(count).toBe(1);
    off();
    client.setCursor({ slideId: 's1', x: 1, y: 1 });
    expect(count).toBe(1);
    await client.dispose();
  });
});
