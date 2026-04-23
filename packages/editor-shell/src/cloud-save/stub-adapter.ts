// packages/editor-shell/src/cloud-save/stub-adapter.ts
// In-memory stub adapter for the cloud-save framework (T-139c).

import type { Document } from '@stageflip/schema';
import { type CloudSaveAdapter, CloudSaveConflictError, type CloudSaveResult } from './types';

/**
 * Options for `createStubCloudSaveAdapter`.
 *
 * `now` injects a fake clock so tests pin `savedAtIso` output; omit
 * for wall-clock time. `seed` preloads the in-memory store keyed by
 * document id — useful for exercising the load path without a prior
 * save.
 *
 * Determinism note: the default `now` path calls `new Date()` at
 * save-time. This module lives OUTSIDE the determinism-scoped paths
 * listed in CLAUDE.md §3, so `Date` is allowed; no `// determinism-
 * safe:` escape hatch is needed.
 */
export interface StubCloudSaveOptions {
  now?: () => Date;
  seed?: ReadonlyMap<string, { doc: Document; revision: number }>;
}

/**
 * Construct a CloudSaveAdapter backed by a `Map<id, Document>`.
 *
 * Phase 6 uses this behind `<CloudSavePanel>` to drive the status
 * state-machine. Phase 12's `@stageflip/collab` package replaces it
 * with a real Firestore-backed adapter; the interface stays stable.
 *
 * `revision` advances monotonically per id on each successful save.
 * `__simulateConflict(id, remote)` arms the adapter to throw
 * `CloudSaveConflictError` on the next save for that id; tests use it
 * to exercise the conflict UI without a real backend.
 */
export function createStubCloudSaveAdapter(options: StubCloudSaveOptions = {}): CloudSaveAdapter & {
  /** Test hook: force the next `save()` for `id` to throw a conflict error. */
  __simulateConflict(id: string, remote: Document): void;
  /** Test hook: force the next save or load to reject with `err`. */
  __simulateError(err: Error): void;
} {
  const now = options.now ?? ((): Date => new Date());
  const store = new Map<string, { doc: Document; revision: number }>();
  if (options.seed) {
    for (const [id, entry] of options.seed) store.set(id, { ...entry });
  }
  let pendingConflict: { id: string; remote: Document } | null = null;
  let pendingError: Error | null = null;

  return {
    displayName: 'StubCloudAdapter',
    async save(doc: Document): Promise<CloudSaveResult> {
      if (pendingError) {
        const err = pendingError;
        pendingError = null;
        throw err;
      }
      const id = doc.meta.id;
      if (pendingConflict && pendingConflict.id === id) {
        const conflict = pendingConflict;
        pendingConflict = null;
        const base = store.get(id)?.doc ?? null;
        throw new CloudSaveConflictError('Revision mismatch', {
          local: doc,
          remote: conflict.remote,
          base,
        });
      }
      const prior = store.get(id);
      const revision = (prior?.revision ?? 0) + 1;
      store.set(id, { doc, revision });
      return {
        id,
        revision,
        savedAtIso: now().toISOString(),
      };
    },
    async load(id: string): Promise<Document> {
      if (pendingError) {
        const err = pendingError;
        pendingError = null;
        throw err;
      }
      const entry = store.get(id);
      if (!entry) throw new Error(`No cloud doc with id ${id}`);
      return entry.doc;
    },
    __simulateConflict(id, remote) {
      pendingConflict = { id, remote };
    },
    __simulateError(err) {
      pendingError = err;
    },
  };
}
