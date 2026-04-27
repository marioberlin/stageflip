// packages/collab/src/provider.ts
// YjsStorageProvider — wraps a StorageAdapter as a Yjs transport per
// ADR-006 §D2. Local Y.Doc updates are forwarded via storage.applyUpdate
// (debounced 50 ms per ADR-006 D8 / AC #11). Remote updates are pulled
// from storage.subscribeUpdates and applied with a stable origin symbol
// so the local-update observer can early-return (AC #12 — origin
// filtering, the echo-loop trap). On construction we bootstrap from
// storage.getSnapshot (Uint8Array OR parsed Document content).
// Subscribe-loop failure triggers reconnect with capped exponential
// backoff (AC #15).

import type { Document } from '@stageflip/schema';
import type { DocumentSnapshot, StorageAdapter } from '@stageflip/storage';
import * as Y from 'yjs';
import { documentToYDoc } from './binding.js';

/** Stable provider-origin symbol used by AC #12 — origin filtering. */
export const PROVIDER_ORIGIN = Symbol('@stageflip/collab/provider');

/** Provider lifecycle status (AC #16). */
export type ProviderStatus = 'syncing' | 'synced' | 'error';

/** Subscribe-callback shape returned by `provider.onStatus`. */
export type StatusListener = (status: ProviderStatus) => void;

/** Constructor args. */
export interface YjsStorageProviderOptions {
  ydoc: Y.Doc;
  storage: StorageAdapter;
  docId: string;
  /**
   * Local-update debounce window in ms. Defaults to 50 ms per ADR-006
   * §"Consequences" (Firestore P95 50–200 ms means coalescing keystrokes
   * keeps local typing snappy without flooding the wire).
   */
  debounceMs?: number;
  /**
   * Reconnect backoff base in ms. Doubles each retry up to `backoffCapMs`,
   * with ±25% jitter. AC #15.
   */
  backoffBaseMs?: number;
  backoffCapMs?: number;
  /**
   * Random source for jitter; tests inject a deterministic source. Defaults
   * to Math.random.
   */
  random?: () => number;
  /**
   * Time source for timers; tests inject a fake. Defaults to globalThis.
   * Allows fake-timer libraries (vitest's `vi.useFakeTimers`) to work.
   */
  setTimeoutImpl?: (cb: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}

/**
 * The provider. Construction starts the subscribe loop and the local-update
 * observer. Call `dispose()` to tear both down.
 */
export class YjsStorageProvider {
  readonly ydoc: Y.Doc;
  readonly storage: StorageAdapter;
  readonly docId: string;

  private _status: ProviderStatus = 'syncing';
  private statusListeners = new Set<StatusListener>();

  /**
   * Snapshot version observed at bootstrap. Used for ChangeSet.parentVersion.
   * Bootstrap-only: NOT updated when a peer compacts mid-session. If a peer
   * rotates the snapshot, this provider's `parentVersion` stays at the
   * bootstrap value until reconnect (next bootstrap()). T-261 / editor-shell
   * consumers will surface whether an explicit refresh API is needed; until
   * then we keep the surface minimal.
   */
  private _latestSnapshotVersion = 0;

  private readonly debounceMs: number;
  private readonly backoffBaseMs: number;
  private readonly backoffCapMs: number;
  private readonly random: () => number;
  private readonly setTimeoutImpl: (cb: () => void, ms: number) => unknown;
  private readonly clearTimeoutImpl: (handle: unknown) => void;

  private pendingBuffer: Uint8Array[] = [];
  private debounceHandle: unknown = null;

  private subscribeAbort: AbortController | null = null;
  private reconnectAttempt = 0;
  private reconnectHandle: unknown = null;
  private syncedTimerHandle: unknown = null;

  private disposed = false;
  private updateObserver: ((update: Uint8Array, origin: unknown) => void) | null = null;

  constructor(opts: YjsStorageProviderOptions) {
    this.ydoc = opts.ydoc;
    this.storage = opts.storage;
    this.docId = opts.docId;
    this.debounceMs = opts.debounceMs ?? 50;
    this.backoffBaseMs = opts.backoffBaseMs ?? 200;
    this.backoffCapMs = opts.backoffCapMs ?? 30_000;
    this.random = opts.random ?? Math.random;
    this.setTimeoutImpl =
      opts.setTimeoutImpl ?? ((cb, ms) => globalThis.setTimeout(cb, ms) as unknown);
    this.clearTimeoutImpl =
      opts.clearTimeoutImpl ?? ((h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>));

    this.installLocalObserver();
    void this.bootstrap();
  }

  /** Current status. */
  get status(): ProviderStatus {
    return this._status;
  }

  /** Last snapshot version observed; used for ChangeSet.parentVersion. */
  get latestSnapshotVersion(): number {
    return this._latestSnapshotVersion;
  }

  /** Subscribe to status transitions. Returns an unsubscribe fn. */
  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Force-flush any pending debounced updates. */
  async flush(): Promise<void> {
    if (this.debounceHandle !== null) {
      this.clearTimeoutImpl(this.debounceHandle);
      this.debounceHandle = null;
    }
    await this.drainPending();
  }

  /** Tear down all resources. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.updateObserver) {
      this.ydoc.off('update', this.updateObserver);
      this.updateObserver = null;
    }
    if (this.debounceHandle !== null) {
      this.clearTimeoutImpl(this.debounceHandle);
      this.debounceHandle = null;
    }
    if (this.reconnectHandle !== null) {
      this.clearTimeoutImpl(this.reconnectHandle);
      this.reconnectHandle = null;
    }
    if (this.syncedTimerHandle !== null) {
      this.clearTimeoutImpl(this.syncedTimerHandle);
      this.syncedTimerHandle = null;
    }
    if (this.subscribeAbort) {
      this.subscribeAbort.abort();
      this.subscribeAbort = null;
    }
  }

  /* ------------------------- private ------------------------- */

  private setStatus(next: ProviderStatus): void {
    if (this._status === next) return;
    this._status = next;
    for (const l of this.statusListeners) l(next);
  }

  private installLocalObserver(): void {
    const observer = (update: Uint8Array, origin: unknown): void => {
      if (this.disposed) return;
      // AC #12 — origin filtering: do not re-emit updates whose origin is us.
      if (origin === PROVIDER_ORIGIN) return;
      this.pendingBuffer.push(update);
      this.scheduleFlush();
    };
    this.ydoc.on('update', observer);
    this.updateObserver = observer;
  }

  private scheduleFlush(): void {
    if (this.debounceHandle !== null) return;
    this.debounceHandle = this.setTimeoutImpl(() => {
      this.debounceHandle = null;
      void this.drainPending();
    }, this.debounceMs);
  }

  private async drainPending(): Promise<void> {
    if (this.pendingBuffer.length === 0) return;
    const updates = this.pendingBuffer;
    this.pendingBuffer = [];
    // Coalesce all buffered updates into a single Y.encodeStateAsUpdate-compatible
    // merged blob via Y.mergeUpdates so the wire carries one applyUpdate call
    // per debounce window (AC #11).
    const merged = updates.length === 1 ? (updates[0] as Uint8Array) : Y.mergeUpdates(updates);
    try {
      await this.storage.applyUpdate(this.docId, merged);
    } catch {
      // D8 case 3: server rejected (e.g. rate-limit). Re-buffer locally.
      this.pendingBuffer.unshift(merged);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private async bootstrap(): Promise<void> {
    if (this.disposed) return;
    this.setStatus('syncing');
    let snapshot: DocumentSnapshot | null = null;
    try {
      snapshot = await this.storage.getSnapshot(this.docId);
    } catch {
      // Treat snapshot fetch failure as "no snapshot"; subscribe loop still tries.
      snapshot = null;
    }
    if (snapshot && !this.disposed) {
      this._latestSnapshotVersion = snapshot.version;
      this.applySnapshotContent(snapshot.content);
    }
    this.startSubscribeLoop();
  }

  private applySnapshotContent(content: unknown): void {
    if (content instanceof Uint8Array) {
      // AC #13 — Y.Doc-encoded snapshot.
      this.ydoc.transact(() => {
        Y.applyUpdate(this.ydoc, content, PROVIDER_ORIGIN);
      }, PROVIDER_ORIGIN);
      return;
    }
    if (typeof content === 'object' && content !== null) {
      // AC #14 — JSON Document content (legacy / migration path).
      this.ydoc.transact(() => {
        documentToYDoc(content as Document, this.ydoc);
      }, PROVIDER_ORIGIN);
    }
  }

  private startSubscribeLoop(): void {
    if (this.disposed) return;
    const ctl = new AbortController();
    this.subscribeAbort = ctl;
    void this.runSubscribeLoop(ctl);
    // AC #16 — transition to `synced` after first remote update OR 500 ms quiet.
    this.scheduleSyncedFallback();
  }

  private scheduleSyncedFallback(): void {
    if (this.syncedTimerHandle !== null) {
      this.clearTimeoutImpl(this.syncedTimerHandle);
    }
    this.syncedTimerHandle = this.setTimeoutImpl(() => {
      this.syncedTimerHandle = null;
      if (!this.disposed && this._status === 'syncing') this.setStatus('synced');
    }, 500);
  }

  private async runSubscribeLoop(ctl: AbortController): Promise<void> {
    try {
      const iter = this.storage.subscribeUpdates(this.docId, { signal: ctl.signal });
      for await (const update of iter) {
        if (this.disposed || ctl.signal.aborted) return;
        Y.applyUpdate(this.ydoc, update, PROVIDER_ORIGIN);
        // First successful remote apply — we are synced.
        if (this._status !== 'synced') {
          this.setStatus('synced');
          if (this.syncedTimerHandle !== null) {
            this.clearTimeoutImpl(this.syncedTimerHandle);
            this.syncedTimerHandle = null;
          }
        }
        // Reset reconnect attempts on success.
        this.reconnectAttempt = 0;
      }
      // Iterator returned cleanly. If we are not disposed, treat as drop.
      if (!this.disposed && !ctl.signal.aborted) this.scheduleReconnect();
    } catch {
      if (this.disposed || ctl.signal.aborted) return;
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.reconnectHandle !== null) return;
    const attempt = this.reconnectAttempt;
    this.reconnectAttempt += 1;
    // Exponential backoff: base * 2^attempt, capped at backoffCapMs, ±25% jitter.
    const exp = Math.min(this.backoffBaseMs * 2 ** attempt, this.backoffCapMs);
    const jitter = exp * 0.25 * (this.random() * 2 - 1);
    const delay = Math.max(0, Math.floor(exp + jitter));
    this.reconnectHandle = this.setTimeoutImpl(() => {
      this.reconnectHandle = null;
      this.startSubscribeLoop();
    }, delay);
  }
}
