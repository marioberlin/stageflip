// packages/export-html5-zip/src/zip.ts
// Deterministic ZIP packer — produces byte-stable output across runs so
// parity harnesses (T-188 / display equivalent) + content-hash caches
// can diff ZIPs at the byte level.
//
// Determinism guarantees:
// - Files written in sorted lexicographic order by path.
// - Every entry carries a fixed mtime (Unix epoch 2000-01-01T00:00:00Z).
// - No compression level variance — `deflate` is deterministic given
//   identical input bytes, and fflate pins its zlib-compatible encoder.
// - No OS attribute bits written (fflate defaults to 0).

import { type Zippable, zipSync } from 'fflate';

/** One file to include in the deterministic ZIP output. */
export interface ZipFile {
  /**
   * Path inside the ZIP. Must use forward slashes, must not start with
   * `/`, must not be empty.
   */
  readonly path: string;
  /** Raw bytes of the file. */
  readonly bytes: Uint8Array;
}

export interface PackZipOptions {
  /**
   * Deflate level 0–9. 0 stores without compression; 9 is densest but
   * slower. Default 6 matches the IAB/GDN convention for HTML5 ads.
   */
  readonly level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

/**
 * Fixed mtime used for every entry in a deterministic ZIP. 2000-01-01
 * UTC — chosen to keep every entry's DOS-time field within the 1980+
 * range fflate supports without the actual wall-clock time leaking in.
 */
export const DETERMINISTIC_ZIP_MTIME = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));

/** Validate a `ZipFile.path` against the ZIP container rules we enforce. */
export function assertValidZipPath(path: string): void {
  if (path.length === 0) throw new Error('zip path must not be empty');
  if (path.startsWith('/')) throw new Error(`zip path '${path}' must not start with '/'`);
  if (path.includes('\\')) {
    throw new Error(`zip path '${path}' must not contain backslashes`);
  }
  if (path.includes('..')) {
    throw new Error(`zip path '${path}' must not contain '..' segments`);
  }
}

/**
 * Pack a set of files into a deterministic ZIP. Paths are sorted; mtimes
 * are pinned to `DETERMINISTIC_ZIP_MTIME`. Two calls with identical
 * inputs produce byte-identical output.
 */
export function packDeterministicZip(
  files: readonly ZipFile[],
  opts: PackZipOptions = {},
): Uint8Array {
  for (const file of files) {
    assertValidZipPath(file.path);
  }
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) {
      throw new Error(`duplicate path in deterministic zip: '${file.path}'`);
    }
    seen.add(file.path);
  }

  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const level: PackZipOptions['level'] = opts.level ?? 6;

  const zippable: Zippable = {};
  for (const file of sorted) {
    zippable[file.path] = [
      file.bytes,
      {
        level,
        mtime: DETERMINISTIC_ZIP_MTIME,
      },
    ];
  }
  return zipSync(zippable);
}

/** Convert a UTF-8 string to a `Uint8Array` for ZIP inclusion. */
export function stringToZipBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
