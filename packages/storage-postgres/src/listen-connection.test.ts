// packages/storage-postgres/src/listen-connection.test.ts
// Validates LISTEN/NOTIFY plumbing semantics against a hand-built fake pool.
// pg-mem's LISTEN/NOTIFY behaviour does not match real PG closely enough to
// pin AC #5–#9 from end-to-end; we exercise the real pg path in
// adapter.integration.test.ts under STAGEFLIP_TEST_PG_INTEGRATION=1. The
// tests here cover the wire-up code that lives between pg's notification
// callback and the public async-iterator surface.

import { describe, expect, it } from 'vitest';

import {
  type ListenPool,
  type ListenPoolClient,
  type PgNotification,
  openListen,
} from './listen-connection.js';

class FakeClient implements ListenPoolClient {
  public released = false;
  public listened: string[] = [];
  public unlistened: string[] = [];
  private listeners: Array<(msg: PgNotification) => void> = [];

  async query(text: string): Promise<unknown> {
    if (text.startsWith('LISTEN')) {
      this.listened.push(text);
    } else if (text.startsWith('UNLISTEN')) {
      this.unlistened.push(text);
    }
    return { rows: [] };
  }
  on(_event: 'notification', cb: (msg: PgNotification) => void): void {
    this.listeners.push(cb);
  }
  off(_event: 'notification', cb: (msg: PgNotification) => void): void {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }
  release(): void {
    this.released = true;
  }
  emit(channel: string, payload?: string): void {
    for (const l of this.listeners) l({ channel, payload });
  }
}

class FakePool implements ListenPool {
  public clients: FakeClient[] = [];
  public connectCount = 0;
  async connect(): Promise<FakeClient> {
    this.connectCount += 1;
    const c = new FakeClient();
    this.clients.push(c);
    return c;
  }
}

describe('openListen', () => {
  it('issues LISTEN on the requested channel', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'updates_doc1');
    expect(pool.connectCount).toBe(1);
    expect(pool.clients[0]?.listened).toEqual(['LISTEN "updates_doc1"']);
    await handle.close();
  });

  it('rejects unsafe channel names (charset)', async () => {
    const pool = new FakePool();
    await expect(openListen(pool, "weird'name")).rejects.toThrow(/unsafe LISTEN channel/);
    expect(pool.connectCount).toBe(0);
  });

  it('payloads() yields notifications in arrival order', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch1');
    const iter = handle.payloads()[Symbol.asyncIterator]();
    pool.clients[0]?.emit('ch1', '1');
    pool.clients[0]?.emit('ch1', '2');
    pool.clients[0]?.emit('ch1', '3');
    expect((await iter.next()).value).toBe('1');
    expect((await iter.next()).value).toBe('2');
    expect((await iter.next()).value).toBe('3');
    await handle.close();
  });

  it('ignores notifications on other channels', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch_a');
    const iter = handle.payloads()[Symbol.asyncIterator]();
    pool.clients[0]?.emit('ch_b', 'wrong');
    pool.clients[0]?.emit('ch_a', 'right');
    expect((await iter.next()).value).toBe('right');
    await handle.close();
  });

  it('treats undefined payload as empty string', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch1');
    const iter = handle.payloads()[Symbol.asyncIterator]();
    pool.clients[0]?.emit('ch1');
    expect((await iter.next()).value).toBe('');
    await handle.close();
  });

  it('aborting the signal closes the handle and releases the connection (AC #7)', async () => {
    const pool = new FakePool();
    const ctl = new AbortController();
    const handle = await openListen(pool, 'ch1', { signal: ctl.signal });
    expect(handle.isClosed()).toBe(false);
    expect(pool.clients[0]?.released).toBe(false);

    ctl.abort();
    // Allow microtask queue to flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(handle.isClosed()).toBe(true);
    expect(pool.clients[0]?.released).toBe(true);
    expect(pool.clients[0]?.unlistened).toEqual(['UNLISTEN "ch1"']);
  });

  it('a pre-aborted signal closes the handle on next microtask', async () => {
    const pool = new FakePool();
    const ctl = new AbortController();
    ctl.abort();
    const handle = await openListen(pool, 'ch1', { signal: ctl.signal });
    await Promise.resolve();
    await Promise.resolve();
    expect(handle.isClosed()).toBe(true);
  });

  it('multiple subscribers each open their own dedicated connection (AC #8)', async () => {
    const pool = new FakePool();
    const a = await openListen(pool, 'ch1');
    const b = await openListen(pool, 'ch1');
    expect(pool.connectCount).toBe(2);
    // Emitting on client A reaches A's iterator only.
    pool.clients[0]?.emit('ch1', 'fromA');
    pool.clients[1]?.emit('ch1', 'fromB');
    const ai = a.payloads()[Symbol.asyncIterator]();
    const bi = b.payloads()[Symbol.asyncIterator]();
    expect((await ai.next()).value).toBe('fromA');
    expect((await bi.next()).value).toBe('fromB');
    await a.close();
    await b.close();
  });

  it('iterator return() closes the handle', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch1');
    const iter = handle.payloads()[Symbol.asyncIterator]();
    expect(handle.isClosed()).toBe(false);
    await iter.return?.();
    expect(handle.isClosed()).toBe(true);
    expect(pool.clients[0]?.released).toBe(true);
  });

  it('close() is idempotent', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch1');
    await handle.close();
    await handle.close();
    expect(handle.isClosed()).toBe(true);
    // No double-release on the underlying client.
    expect(pool.clients[0]?.unlistened.length).toBe(1);
  });

  it('next() after close() returns done=true', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch1');
    await handle.close();
    const iter = handle.payloads()[Symbol.asyncIterator]();
    const r = await iter.next();
    expect(r.done).toBe(true);
  });

  it('survives client.off() throwing (defensive)', async () => {
    const pool = new FakePool();
    const handle = await openListen(pool, 'ch1');
    const c = pool.clients[0];
    if (!c) throw new Error('no client');
    c.off = (): void => {
      throw new Error('boom');
    };
    await expect(handle.close()).resolves.toBeUndefined();
    expect(handle.isClosed()).toBe(true);
  });
});
