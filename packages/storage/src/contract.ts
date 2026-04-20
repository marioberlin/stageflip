// packages/storage/src/contract.ts
// The 3-method storage contract per docs/implementation-plan.md T-025 and
// skills/stageflip/concepts/collab/SKILL.md. A StorageAdapter implements all
// three methods; concrete adapters (in-memory now; Firebase at T-036;
// Postgres at T-270) follow the same interface so higher layers do not
// bind to a specific backend.
//
// The three method pairs serve different timescales:
//   - Snapshot  — durable, full-document reads/writes (low frequency)
//   - Update    — binary CRDT deltas for live collab (high frequency)
//   - Patch     — semantic JSON-Patch operations for undo/redo + audit log

import { z } from 'zod';

/* --------------------------- Snapshot --------------------------- */

/**
 * A durable snapshot of a document. `content` is schema-typed by a higher
 * layer (@stageflip/schema validates); at the storage layer it is `unknown`
 * so adapters can be schema-agnostic.
 */
export const documentSnapshotSchema = z
  .object({
    docId: z.string().min(1),
    version: z.number().int().nonnegative(),
    content: z.unknown(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;

/* ---------------------------- Patch ----------------------------- */

/** A single JSON Patch op (RFC 6902). */
export const jsonPatchOpSchema = z
  .object({
    op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
    path: z.string(),
    value: z.unknown().optional(),
    from: z.string().optional(),
  })
  .strict();
export type JsonPatchOp = z.infer<typeof jsonPatchOpSchema>;

/** A semantic change — one or more ops, attributed to an actor. */
export const changeSetSchema = z
  .object({
    id: z.string().min(1),
    docId: z.string().min(1),
    parentVersion: z.number().int().nonnegative(),
    ops: z.array(jsonPatchOpSchema).min(1),
    actor: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .strict();
export type ChangeSet = z.infer<typeof changeSetSchema>;

/* --------------------------- Contract --------------------------- */

/** Options accepted by subscribeUpdates and getHistory. */
export interface SubscribeOptions {
  signal?: AbortSignal;
}
export interface HistoryOptions {
  /** Most recent N ChangeSets. Omit for all. */
  limit?: number;
  /** Only return ChangeSets with createdAt > after (ISO). */
  after?: string;
}

/**
 * Storage contract. Adapters implement all six methods.
 * Concurrency/consistency guarantees are documented per-adapter.
 */
export interface StorageAdapter {
  /** Snapshot tier — durable full-doc reads/writes. */
  getSnapshot(docId: string): Promise<DocumentSnapshot | null>;
  putSnapshot(docId: string, snapshot: DocumentSnapshot): Promise<void>;

  /** Update tier — binary CRDT deltas for live collab (exercised by T-260). */
  applyUpdate(docId: string, update: Uint8Array): Promise<void>;
  subscribeUpdates(docId: string, opts?: SubscribeOptions): AsyncIterable<Uint8Array>;

  /** Patch tier — semantic JSON Patch operations for undo/redo + audit log. */
  applyPatch(docId: string, patch: ChangeSet): Promise<void>;
  getHistory(docId: string, opts?: HistoryOptions): AsyncIterable<ChangeSet>;
}

/**
 * Thrown when applyPatch is called with a ChangeSet whose parentVersion does
 * not match the current snapshot version. Callers rebase and retry.
 */
export class StorageVersionMismatchError extends Error {
  constructor(
    public readonly docId: string,
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(`storage: ${docId} expected version ${expected}, got ${actual}`);
    this.name = 'StorageVersionMismatchError';
  }
}
