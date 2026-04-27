// packages/collab/src/client.ts
// CollabClient — consumer-facing API around YjsStorageProvider + the
// command registry per T-260 ACs #18–#21.

import type { Document } from '@stageflip/schema';
import type { ChangeSet, StorageAdapter } from '@stageflip/storage';
import * as Y from 'yjs';
import { yDocToDocument } from './binding.js';
import { emitChangeSet } from './changeset.js';
import {
  COMMAND_REGISTRY,
  type CommandArgs,
  type CommandContext,
  type CommandName,
} from './commands/index.js';
import { type ProviderStatus, YjsStorageProvider } from './provider.js';

/** Constructor args. */
export interface CollabClientOptions {
  docId: string;
  storage: StorageAdapter;
  actor: string;
  /**
   * ChangeSet debounce window for Y.Text edits in ms. Defaults to 250 ms
   * per AC #27. Distinct from the provider's 50 ms Y.Doc debounce (AC #11).
   */
  changeSetDebounceMs?: number;
  /** Override the Y.Doc; defaults to a fresh one. */
  ydoc?: Y.Doc;
  /** Test hook — see provider.ts. */
  setTimeoutImpl?: (cb: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
}

export class CollabClient {
  readonly docId: string;
  readonly storage: StorageAdapter;
  readonly actor: string;
  readonly ydoc: Y.Doc;
  readonly provider: YjsStorageProvider;

  private readonly changeSetDebounceMs: number;
  private readonly setTimeoutImpl: (cb: () => void, ms: number) => unknown;
  private readonly clearTimeoutImpl: (handle: unknown) => void;

  /** Pending debounced ChangeSet emitters keyed by command-supplied bucket. */
  private debouncedEmits = new Map<string, { handle: unknown; build: () => ChangeSet }>();

  /** Cache for `client.document` stable-equality (AC #19). */
  private documentCache: { tick: number; value: Document } | null = null;
  private mutationTick = 0;

  private disposed = false;

  constructor(opts: CollabClientOptions) {
    this.docId = opts.docId;
    this.storage = opts.storage;
    this.actor = opts.actor;
    this.changeSetDebounceMs = opts.changeSetDebounceMs ?? 250;
    this.setTimeoutImpl =
      opts.setTimeoutImpl ?? ((cb, ms) => globalThis.setTimeout(cb, ms) as unknown);
    this.clearTimeoutImpl =
      opts.clearTimeoutImpl ?? ((h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>));
    this.ydoc = opts.ydoc ?? new Y.Doc();
    this.provider = new YjsStorageProvider({
      ydoc: this.ydoc,
      storage: this.storage,
      docId: this.docId,
    });

    // Bump cache invalidator on every Y.Doc mutation.
    this.ydoc.on('update', () => {
      this.mutationTick += 1;
    });
  }

  /** Resolves once the provider transitions to `synced`. */
  async hydrate(): Promise<void> {
    if (this.provider.status === 'synced') return;
    // We do not reject on `error` — the provider's reconnect loop drives
    // back to `synced`. Callers needing failure-aware UX subscribe via
    // `provider.onStatus` directly.
    return new Promise((resolve, _reject) => {
      const off = this.provider.onStatus((s: ProviderStatus) => {
        if (s === 'synced') {
          off();
          resolve();
        }
      });
    });
  }

  /** Returns the current Document view. Stable-equal across reads if no mutations. */
  get document(): Document {
    if (this.documentCache && this.documentCache.tick === this.mutationTick) {
      return this.documentCache.value;
    }
    const value = yDocToDocument(this.ydoc);
    this.documentCache = { tick: this.mutationTick, value };
    return value;
  }

  /** Run a registered command. Throws if unknown. */
  async command<K extends CommandName>(name: K, args: CommandArgs[K]): Promise<void> {
    if (this.disposed) throw new Error('command: client is disposed');
    const fn = COMMAND_REGISTRY[name];
    if (!fn) throw new Error(`command: unknown command "${String(name)}"`);
    const ctx: CommandContext = {
      ydoc: this.ydoc,
      provider: this.provider,
      storage: this.storage,
      docId: this.docId,
      actor: this.actor,
      parentVersion: () => this.provider.latestSnapshotVersion,
      emitDebounced: (key, build) => this.scheduleDebouncedEmit(key, build),
      emit: (cs) => emitChangeSet(this.storage, cs),
    };
    // The registry is keyed by name; cast preserves the per-command Args
    // mapping at the call site.
    await (fn as (c: CommandContext, a: CommandArgs[K]) => Promise<void>)(ctx, args);
  }

  /** Force-flush any pending debounced ChangeSets + provider updates. */
  async flush(): Promise<void> {
    for (const [key, entry] of this.debouncedEmits) {
      this.clearTimeoutImpl(entry.handle);
      this.debouncedEmits.delete(key);
      await emitChangeSet(this.storage, entry.build());
    }
    await this.provider.flush();
  }

  /** Tear down. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [, entry] of this.debouncedEmits) {
      this.clearTimeoutImpl(entry.handle);
    }
    this.debouncedEmits.clear();
    this.provider.dispose();
    this.ydoc.destroy();
  }

  /* ------------------------- private ------------------------- */

  private scheduleDebouncedEmit(key: string, build: () => ChangeSet): void {
    const existing = this.debouncedEmits.get(key);
    if (existing) {
      this.clearTimeoutImpl(existing.handle);
    }
    const entry = {
      build,
      handle: this.setTimeoutImpl(() => {
        const current = this.debouncedEmits.get(key);
        if (!current) return;
        this.debouncedEmits.delete(key);
        // Fire the latest build() at flush time so the ChangeSet captures
        // the final state.
        void emitChangeSet(this.storage, current.build()).catch(() => {
          // Storage write failure: ChangeSet is best-effort audit; the Y.Doc
          // mutation already fanned out. T-263 introduces explicit retry.
        });
      }, this.changeSetDebounceMs),
    };
    this.debouncedEmits.set(key, entry);
  }
}
