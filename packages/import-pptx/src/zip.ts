// packages/import-pptx/src/zip.ts
// Thin synchronous wrapper around fflate.unzipSync. PPTX files are typically
// <50 MB; sync unpack into memory keeps the parser deterministic and makes
// the API a pure (Uint8Array) -> CanonicalSlideTree function.

import { strFromU8, unzipSync } from 'fflate';
import { PptxParseError } from './types.js';

/** A flat map from OPC part path -> raw byte payload. */
export type ZipEntries = Record<string, Uint8Array>;

/**
 * Unpack a `.pptx` byte buffer into a path -> bytes map. Throws
 * `PptxParseError(INVALID_ZIP)` on any underlying decoder failure.
 */
export function unpackPptx(buffer: Uint8Array): ZipEntries {
  try {
    return unzipSync(buffer);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new PptxParseError('INVALID_ZIP', `failed to unzip pptx: ${cause}`);
  }
}

/**
 * Decode a ZIP entry as UTF-8 text. Returns `undefined` if the entry is
 * absent. PPTX XML parts are always UTF-8 per the OOXML spec.
 */
export function readTextEntry(entries: ZipEntries, path: string): string | undefined {
  const bytes = entries[path];
  if (bytes === undefined) return undefined;
  return strFromU8(bytes);
}
