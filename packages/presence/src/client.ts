// packages/presence/src/client.ts
// PresenceClient — consumer-facing API around a PresenceAdapter. Owns the
// local presence record, the heartbeat interval, the cursor-debounce timer,
// and the activity-driven status transitions per D-T261-2.
//
// Per ADR-006 §D5, this client must NOT import `y-protocols/awareness` and
// must NOT instantiate `Y.Awareness`. Presence is a separate plane, on
// purpose. Verified by the absence of those imports in this file.

import type { PresenceAdapter } from './contract.js';
import { type Presence, colorForUserId } from './presence.js';

/** Heartbeat cadence — D-T261-2. */
export const HEARTBEAT_MS = 10_000;
/** Cursor-write debounce — D-T261-3. */
export const CURSOR_DEBOUNCE_MS = 50;
/** Idle threshold — D-T261-2. */
export const IDLE_AFTER_MS = 30_000;
/** Away threshold — D-T261-2. */
export const AWAY_AFTER_MS = 5 * 60_000;

export interface PresenceClientOptions {
  adapter: PresenceAdapter;
  docId: string;
  userId: string;
  /** Override; defaults to colorForUserId(userId) per AC #22. */
  color?: string;

  /** Test hooks — overridable timers/clock. */
  setIntervalImpl?: (cb: () => void, ms: number) => unknown;
  clearIntervalImpl?: (handle: unknown) => void;
  setTimeoutImpl?: (cb: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
  now?: () => number;

  /** Override default heartbeat cadence (test only). */
  heartbeatMs?: number;
  /** Override default cursor debounce (test only). */
  cursorDebounceMs?: number;
}

/** Subscriber for local-presence changes (UI sees every update). */
export type LocalListener = (p: Presence) => void;

export class PresenceClient {
  readonly docId: string;
  readonly userId: string;
  readonly color: string;

  private readonly adapter: PresenceAdapter;
  private readonly setIntervalImpl: (cb: () => void, ms: number) => unknown;
  private readonly clearIntervalImpl: (handle: unknown) => void;
  private readonly setTimeoutImpl: (cb: () => void, ms: number) => unknown;
  private readonly clearTimeoutImpl: (handle: unknown) => void;
  private readonly now: () => number;
  private readonly heartbeatMs: number;
  private readonly cursorDebounceMs: number;

  /** Current local presence record. Always reflects the latest setCursor/setSelection. */
  private current: Presence;
  /** Last time the user produced input (cursor/selection); used for status transitions. */
  private lastInputMs: number;

  private heartbeatHandle: unknown = null;
  private cursorTimer: unknown = null;
  /** Pending cursor delta to flush on the debounce tick. */
  private pendingCursorWrite = false;
  private subscribeAbort: AbortController | null = null;

  private localListeners = new Set<LocalListener>();
  private connected = false;
  private disposed = false;

  constructor(opts: PresenceClientOptions) {
    this.adapter = opts.adapter;
    this.docId = opts.docId;
    this.userId = opts.userId;
    this.color = opts.color ?? colorForUserId(opts.userId);

    this.setIntervalImpl =
      opts.setIntervalImpl ?? ((cb, ms) => globalThis.setInterval(cb, ms) as unknown);
    this.clearIntervalImpl =
      opts.clearIntervalImpl ??
      ((h) => globalThis.clearInterval(h as ReturnType<typeof setInterval>));
    this.setTimeoutImpl =
      opts.setTimeoutImpl ?? ((cb, ms) => globalThis.setTimeout(cb, ms) as unknown);
    this.clearTimeoutImpl =
      opts.clearTimeoutImpl ?? ((h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>));
    this.now = opts.now ?? (() => Date.now());
    this.heartbeatMs = opts.heartbeatMs ?? HEARTBEAT_MS;
    this.cursorDebounceMs = opts.cursorDebounceMs ?? CURSOR_DEBOUNCE_MS;

    const startedAt = this.now();
    this.lastInputMs = startedAt;
    this.current = {
      userId: this.userId,
      color: this.color,
      lastSeenMs: startedAt,
      status: 'active',
    };
  }

  /** Returns the current local presence record. */
  get local(): Presence {
    return this.current;
  }

  /** Subscribe to local-presence changes. Fires on every setCursor/setSelection
   * (no debounce) so UI sees no lag (AC #16). */
  onLocal(cb: LocalListener): () => void {
    this.localListeners.add(cb);
    return () => {
      this.localListeners.delete(cb);
    };
  }

  /** Connect: write the first record and register disconnect cleanup. */
  async connect(): Promise<void> {
    if (this.disposed) throw new Error('connect: client is disposed');
    if (this.connected) return;
    this.connected = true;
    this.current = { ...this.current, lastSeenMs: this.now() };
    await this.adapter.set(this.docId, this.userId, this.current);
    await this.adapter.registerDisconnectCleanup(this.docId, this.userId);
    this.heartbeatHandle = this.setIntervalImpl(() => {
      void this.heartbeat();
    }, this.heartbeatMs);
  }

  /**
   * Update the local cursor. Local listeners fire immediately; the wire write
   * is debounced to {@link CURSOR_DEBOUNCE_MS} (AC #16).
   */
  setCursor(cursor: { slideId: string; x: number; y: number }): void {
    if (this.disposed) return;
    const t = this.now();
    this.lastInputMs = t;
    this.current = {
      ...this.current,
      cursor,
      lastSeenMs: t,
      status: 'active',
    };
    this.notifyLocal();
    this.scheduleCursorWrite();
  }

  /** Update selection. NOT debounced — every call writes through (AC #17). */
  async setSelection(selection: { elementIds: string[] }): Promise<void> {
    if (this.disposed) return;
    const t = this.now();
    this.lastInputMs = t;
    this.current = {
      ...this.current,
      selection,
      lastSeenMs: t,
      status: 'active',
    };
    this.notifyLocal();
    if (this.connected) {
      await this.adapter.set(this.docId, this.userId, this.current);
    }
  }

  /**
   * Subscribe to peer presence changes. Excludes the local user (AC #18) so
   * consumers don't get a feedback loop where they see their own cursor.
   */
  subscribe(): AsyncIterable<Map<string, Presence>> {
    if (this.disposed) throw new Error('subscribe: client is disposed');
    if (!this.subscribeAbort) {
      this.subscribeAbort = new AbortController();
    }
    const ac = this.subscribeAbort;
    const upstream = this.adapter.subscribe(this.docId, { signal: ac.signal });
    const localUserId = this.userId;
    return {
      [Symbol.asyncIterator]: () => {
        const it = upstream[Symbol.asyncIterator]();
        return {
          next: async (): Promise<IteratorResult<Map<string, Presence>>> => {
            const r = await it.next();
            if (r.done) return r;
            // Strip the local user; return a fresh map so callers can't
            // mutate adapter state.
            const filtered = new Map<string, Presence>();
            for (const [uid, p] of r.value) {
              if (uid !== localUserId) filtered.set(uid, p);
            }
            return { value: filtered, done: false };
          },
          return: async () => {
            ac.abort();
            await it.return?.();
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  /** Tear down. Idempotent (AC #21). */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.heartbeatHandle !== null) {
      this.clearIntervalImpl(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
    if (this.cursorTimer !== null) {
      this.clearTimeoutImpl(this.cursorTimer);
      this.cursorTimer = null;
      this.pendingCursorWrite = false;
    }
    if (this.subscribeAbort) {
      this.subscribeAbort.abort();
      this.subscribeAbort = null;
    }
    if (this.connected) {
      this.connected = false;
      await this.adapter.remove(this.docId, this.userId);
    }
    this.localListeners.clear();
  }

  /* ------------------------- private ------------------------- */

  private notifyLocal(): void {
    for (const cb of this.localListeners) cb(this.current);
  }

  private scheduleCursorWrite(): void {
    if (!this.connected) return;
    this.pendingCursorWrite = true;
    if (this.cursorTimer !== null) return;
    this.cursorTimer = this.setTimeoutImpl(() => {
      this.cursorTimer = null;
      if (!this.pendingCursorWrite || this.disposed) return;
      this.pendingCursorWrite = false;
      // Fire-and-forget: the next setCursor call will reschedule on failure
      // via its own debounce. Persistent retry is out of scope per spec.
      void this.adapter.set(this.docId, this.userId, this.current).catch(() => {
        // Best-effort wire write; UI already saw the local update.
      });
    }, this.cursorDebounceMs);
  }

  private async heartbeat(): Promise<void> {
    if (this.disposed || !this.connected) return;
    const t = this.now();
    const sinceInput = t - this.lastInputMs;
    let status: Presence['status'] = 'active';
    if (sinceInput >= AWAY_AFTER_MS) status = 'away';
    else if (sinceInput >= IDLE_AFTER_MS) status = 'idle';
    this.current = { ...this.current, lastSeenMs: t, status };
    this.notifyLocal();
    try {
      await this.adapter.set(this.docId, this.userId, this.current);
    } catch {
      // Heartbeat failure is non-fatal; the next tick retries.
    }
  }
}
