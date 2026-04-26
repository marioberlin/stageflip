// packages/export-pptx/src/zip/pack.ts
// Deterministic ZIP packer built on fflate. Pins compression level and
// per-entry mtime so two calls with identical inputs produce byte-identical
// ZIP output. Entry order is sorted alphabetically by archive path.

import { strToU8, zipSync } from 'fflate';
import { FROZEN_EPOCH } from '../types.js';

/** Either raw bytes or a string (auto-encoded as UTF-8). */
export type EntryPayload = Uint8Array | string;

/** A flat archive-path -> payload map. */
export type EntryMap = Record<string, EntryPayload>;

/**
 * Pack the given entries into a ZIP buffer. Pins:
 *   - DEFLATE level 6 (fflate default), pinned explicitly so a future
 *     fflate upgrade that changes defaults does not silently change output.
 *   - Per-entry `mtime` is the same `modifiedAt` for every entry — uniform.
 *   - Entry order is sorted alphabetically by archive path so two calls are
 *     byte-identical.
 */
export function packZip(entries: EntryMap, modifiedAt: Date = FROZEN_EPOCH): Uint8Array {
  // fflate's `zipSync` preserves the insertion order of the entries map. We
  // therefore build a sorted-key map to pin entry order.
  const sortedKeys = Object.keys(entries).sort();
  // fflate's per-entry attribute shape: `[bytes, attrs]` tuple.
  type FflateEntry = [Uint8Array, { mtime: Date; level: number }];
  const sorted: Record<string, FflateEntry> = {};
  for (const key of sortedKeys) {
    const payload = entries[key];
    const bytes = typeof payload === 'string' ? strToU8(payload) : (payload ?? new Uint8Array(0));
    sorted[key] = [bytes, { mtime: modifiedAt, level: 6 }];
  }
  return zipSync(sorted as unknown as Parameters<typeof zipSync>[0]);
}
