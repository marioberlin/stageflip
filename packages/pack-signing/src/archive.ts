// packages/pack-signing/src/archive.ts
// T-498 — Deterministic in-house archive format for `.stageflip-pack`
// publishing. Sidesteps a tar/zstd dependency for the local sign +
// verify roundtrip the loader's gate consumes (the manifest's
// `integrity.hash` is opaque to the format).
//
// Determinism perimeter: `@stageflip/pack-signing` lives OUTSIDE the
// determinism perimeter (publisher-side host code).

/** 8-byte magic prefix + newline. Used to fail-fast on parse mismatch. */
export const ARCHIVE_MAGIC = new Uint8Array([
  0x53, // 'S'
  0x46, // 'F'
  0x50, // 'P'
  0x41, // 'A'
  0x43, // 'C'
  0x4b, // 'K'
  0x31, // '1'
  0x0a, // '\n'
]);

/** One file entry going into / coming out of the archive. */
export interface ArchiveFile {
  /** Relative path (POSIX-style separators). Sorted ascending on synthesis. */
  readonly path: string;
  /** Raw file content. */
  readonly content: Uint8Array;
}

/**
 * Synthesize a deterministic concatenated archive from a list of files.
 *
 * Format (T-498 placeholder — production marketplaces post-T-499 may
 * need a richer format; this is sufficient for the local sign + verify
 * roundtrip and the lookup keys T-495's loader consumes):
 *
 * ```
 * SFPACK1\n                              (8-byte magic + newline)
 * <file count (4-byte BE uint)>
 * For each file (sorted ascending by relative path):
 *   <path-length (2-byte BE uint)><path bytes (UTF-8)>
 *   <content-length (4-byte BE uint)><content bytes>
 * ```
 *
 * Sorting is lexicographic on the relative path string — that's what
 * makes the archive byte-stable across shuffled inputs.
 */
export function synthesizeArchive(files: readonly ArchiveFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  // Pre-encode paths so we measure once.
  const encoded: { pathBytes: Uint8Array; content: Uint8Array }[] = sorted.map((f) => ({
    pathBytes: encoder.encode(f.path),
    content: f.content,
  }));

  let total = ARCHIVE_MAGIC.length + 4;
  for (const { pathBytes, content } of encoded) {
    total += 2 + pathBytes.length + 4 + content.length;
  }
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  let offset = 0;
  out.set(ARCHIVE_MAGIC, offset);
  offset += ARCHIVE_MAGIC.length;
  view.setUint32(offset, encoded.length, false);
  offset += 4;
  for (const { pathBytes, content } of encoded) {
    if (pathBytes.length > 0xffff) {
      throw new ArchiveSynthesizeError(`path too long (>${0xffff} bytes): ${pathBytes.length}`);
    }
    if (content.length > 0xffffffff) {
      throw new ArchiveSynthesizeError(
        `content too long (>${0xffffffff} bytes): ${content.length}`,
      );
    }
    view.setUint16(offset, pathBytes.length, false);
    offset += 2;
    out.set(pathBytes, offset);
    offset += pathBytes.length;
    view.setUint32(offset, content.length, false);
    offset += 4;
    out.set(content, offset);
    offset += content.length;
  }
  return out;
}

/**
 * Parse a previously-synthesized archive back into an ordered list of
 * `ArchiveFile`. Throws `ArchiveParseError` on magic mismatch, length
 * overrun, or truncated content / path.
 */
export function parseArchive(bytes: Uint8Array): ArchiveFile[] {
  if (bytes.length < ARCHIVE_MAGIC.length + 4) {
    throw new ArchiveParseError('archive too short for header');
  }
  for (let i = 0; i < ARCHIVE_MAGIC.length; i += 1) {
    if (bytes[i] !== ARCHIVE_MAGIC[i]) {
      throw new ArchiveParseError('archive magic mismatch');
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = ARCHIVE_MAGIC.length;
  const count = view.getUint32(offset, false);
  offset += 4;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const out: ArchiveFile[] = [];
  for (let i = 0; i < count; i += 1) {
    if (offset + 2 > bytes.length) {
      throw new ArchiveParseError('truncated path-length header');
    }
    const pathLen = view.getUint16(offset, false);
    offset += 2;
    if (offset + pathLen > bytes.length) {
      throw new ArchiveParseError('truncated path bytes');
    }
    const path = decoder.decode(bytes.subarray(offset, offset + pathLen));
    offset += pathLen;
    if (offset + 4 > bytes.length) {
      throw new ArchiveParseError('truncated content-length header');
    }
    const contentLen = view.getUint32(offset, false);
    offset += 4;
    if (offset + contentLen > bytes.length) {
      throw new ArchiveParseError('truncated content bytes');
    }
    const content = bytes.slice(offset, offset + contentLen);
    offset += contentLen;
    out.push({ path, content });
  }
  return out;
}

/** Thrown by `parseArchive` on any malformed input. */
export class ArchiveParseError extends Error {
  override readonly name = 'ArchiveParseError';
}

/** Thrown by `synthesizeArchive` on inputs that exceed format bounds. */
export class ArchiveSynthesizeError extends Error {
  override readonly name = 'ArchiveSynthesizeError';
}
