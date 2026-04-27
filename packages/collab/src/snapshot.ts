// packages/collab/src/snapshot.ts
// compact() helper per ADR-006 §D4 / T-260 ACs #30–#32. Operational
// callers (cron, worker) invoke this; the package itself ships only the
// helper.

import type { DocumentSnapshot, StorageAdapter } from '@stageflip/storage';
import * as Y from 'yjs';

let nowProvider: () => string = () => new Date().toISOString();

/** Test hook — swap the timestamp source. Returns the previous provider. */
export function setSnapshotNowProvider(fn: () => string): () => string {
  const prev = nowProvider;
  nowProvider = fn;
  return prev;
}

/**
 * Crystallize a `DocumentSnapshot` from the current Y.Doc state via
 * `Y.encodeStateAsUpdate`. The version is monotonically derived from the
 * current persisted snapshot (n+1; or 1 if none).
 *
 * AC #31 — concurrent compaction safety: the contract here is "the second
 * compaction overwrites cleanly". Two concurrent calls observe the same
 * pre-state version, both compute version = pre + 1, and both write; the
 * later write wins by clock arrival at the storage adapter. This is
 * acceptable for in-memory and Firestore (which serializes writes at the
 * doc level); CAS-on-version is a future evolution if a backend that
 * weakens this surfaces.
 */
export async function compact(
  docId: string,
  ydoc: Y.Doc,
  storage: StorageAdapter,
): Promise<DocumentSnapshot> {
  const current = await storage.getSnapshot(docId);
  const nextVersion = (current?.version ?? 0) + 1;
  const update = Y.encodeStateAsUpdate(ydoc);
  const snapshot: DocumentSnapshot = {
    docId,
    version: nextVersion,
    content: update,
    updatedAt: nowProvider(),
  };
  await storage.putSnapshot(docId, snapshot);
  return snapshot;
}
