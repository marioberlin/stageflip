// packages/editor-shell/src/cloud-save/types.ts
// Contracts for the cloud-save framework surface (T-139c).

import type { Document } from '@stageflip/schema';

/**
 * The cloud-save status machine. The UI maps each state to a badge +
 * button affordance; the stub adapter walks through these
 * deterministically in tests.
 *
 *   idle     → no save in flight
 *   saving   → `save()` is running
 *   saved    → last save succeeded; persists until next edit
 *   conflict → remote diverged; user picks a resolution
 *   error    → save failed for a non-conflict reason
 */
export type CloudSaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface CloudSaveResult {
  /** Server-assigned id for the saved document. */
  id: string;
  /** Monotonic revision counter for optimistic concurrency. */
  revision: number;
  /** Server wall-clock timestamp, ISO-8601. */
  savedAtIso: string;
}

/**
 * Minimum adapter contract. The real `@stageflip/collab` backend lands
 * in Phase 12; Phase 6 ships a stub that accepts every `save()`,
 * letting us wire UI + status semantics now.
 *
 * `save()` rejects with a `CloudSaveConflictError` when the server
 * reports a revision mismatch — the UI reads the error `remote` field
 * to render the three-way diff. Any other failure is a generic
 * `Error` that the UI surfaces via the `error` state.
 */
export interface CloudSaveAdapter {
  /** Human-readable label for diagnostics / `<CloudSavePanel>`. */
  readonly displayName: string;
  save(doc: Document): Promise<CloudSaveResult>;
  load(id: string): Promise<Document>;
}

/**
 * Thrown by an adapter when the caller's revision is stale. UI picks up
 * `local` + `remote` + `base` to render the conflict panel.
 */
export class CloudSaveConflictError extends Error {
  readonly local: Document;
  readonly remote: Document;
  readonly base: Document | null;

  constructor(
    message: string,
    parts: { local: Document; remote: Document; base: Document | null },
  ) {
    super(message);
    this.name = 'CloudSaveConflictError';
    this.local = parts.local;
    this.remote = parts.remote;
    this.base = parts.base;
  }
}
