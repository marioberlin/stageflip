// packages/collab/src/changeset.ts
// ChangeSet helpers — build RFC 6902 patch ops from intent-level commands
// per ADR-006 §D3. Y.Text per-keystroke edits collapse to a single
// `replace` ChangeSet within a 250 ms debounce window (AC #27); other
// commands emit one ChangeSet per transaction.

import type { ChangeSet, JsonPatchOp, StorageAdapter } from '@stageflip/storage';

/**
 * Generate a ChangeSet id. Wrapped so tests can swap in a deterministic
 * source via `setChangeSetIdProvider`.
 */
let idProvider: () => string = () => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for test environments without crypto.randomUUID.
  return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
let nowProvider: () => string = () => new Date().toISOString();

/** Test hook — swap the id source. Returns the previous provider. */
export function setChangeSetIdProvider(fn: () => string): () => string {
  const prev = idProvider;
  idProvider = fn;
  return prev;
}

/** Test hook — swap the timestamp source. */
export function setChangeSetNowProvider(fn: () => string): () => string {
  const prev = nowProvider;
  nowProvider = fn;
  return prev;
}

/** Build a ChangeSet from one or more JSON-Patch ops. */
export function buildChangeSet(args: {
  docId: string;
  parentVersion: number;
  ops: JsonPatchOp[];
  actor: string;
}): ChangeSet {
  return {
    id: idProvider(),
    docId: args.docId,
    parentVersion: args.parentVersion,
    ops: args.ops,
    actor: args.actor,
    createdAt: nowProvider(),
  };
}

/**
 * Append a ChangeSet to the storage adapter via `applyPatch`. Wrapped so
 * tests can intercept; in prod this is a thin pass-through.
 */
export async function emitChangeSet(storage: StorageAdapter, changeSet: ChangeSet): Promise<void> {
  await storage.applyPatch(changeSet.docId, changeSet);
}

/**
 * Compute the minimal Y.Text-style insert/delete ops to transform `prev`
 * into `next`. Used by `setTextRun` (AC #26) to avoid the catastrophic
 * "delete-all + insert-all" pattern that drops concurrent edits.
 *
 * The result is a list of edits to apply in order to `prev` (which becomes
 * `next` after applying). Edits use Y.Text semantics:
 *   - { op: 'delete', index, length }
 *   - { op: 'insert', index, value }
 *
 * Algorithm: longest common prefix + suffix. Adequate for the
 * single-character / contiguous-paste cases that AC #26 pins; covers the
 * 99% interactive case. (A full Myers diff is overkill and not load-bearing
 * for AC #26 which only requires "single-char insertion in middle yields one
 * insert and zero deletes".)
 */
export interface TextEdit {
  op: 'insert' | 'delete';
  index: number;
  /** insert: the string to insert; delete: undefined. */
  value?: string;
  /** delete: how many chars to remove. */
  length?: number;
}

export function diffText(prev: string, next: string): TextEdit[] {
  if (prev === next) return [];
  let prefix = 0;
  const minLen = Math.min(prev.length, next.length);
  while (prefix < minLen && prev[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const deleteLen = prev.length - prefix - suffix;
  const insertStr = next.slice(prefix, next.length - suffix);

  const out: TextEdit[] = [];
  // Delete must be applied before insert at the same index so the resulting
  // index space matches Y.Text's expectations.
  if (deleteLen > 0) out.push({ op: 'delete', index: prefix, length: deleteLen });
  if (insertStr.length > 0) out.push({ op: 'insert', index: prefix, value: insertStr });
  return out;
}
