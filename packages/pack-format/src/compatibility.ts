// packages/pack-format/src/compatibility.ts
// T-502 — Engine version ↔ pack-format manifestVersion compatibility
// matrix. Authoritative table of which platform releases support which
// manifest schemas. Both the pack-loader install-time gate (T-495) and
// the pack-publish-cli validate command (T-500) consult this to refuse
// version-incompatible packs before they hit the runtime.
//
// Determinism perimeter: this package lives OUTSIDE per CLAUDE.md §3.

import { satisfiesRange } from './semver-range.js';

/**
 * One row of the compatibility matrix: an engine semver range and the
 * `manifestVersion` values it supports.
 */
export interface CompatibilityRow {
  /** Engine semver range (npm-style); e.g. `">=2.0.0 <3.0.0"`. */
  readonly engineRange: string;
  /** Manifest versions readable by engines in `engineRange`. */
  readonly manifestVersions: readonly string[];
  /** Optional note shown in tooling. */
  readonly note?: string;
}

/**
 * All compatibility rows, ordered newest-engine-first. Future rows for
 * `manifestVersion: '2'` etc. will be prepended here. The matrix is
 * the single source of truth queried by `isCompatible`,
 * `readableManifestVersions`, and `matchingRows`.
 */
export const COMPATIBILITY_MATRIX: readonly CompatibilityRow[] = [
  {
    engineRange: '>=2.0.0',
    manifestVersions: ['1'],
    note: 'P16 launch: manifestVersion 1 only',
  },
  // Future rows when manifestVersion 2 ships will be added here.
];

/**
 * Test whether the supplied `(engineVersion, manifestVersion)` pair is
 * supported by any row in `COMPATIBILITY_MATRIX`. Returns `false` for
 * malformed engine versions and for `manifestVersion` values not listed
 * in any matching row. Never throws.
 */
export function isCompatible(engineVersion: string, manifestVersion: string): boolean {
  for (const row of COMPATIBILITY_MATRIX) {
    if (satisfiesRange(engineVersion, row.engineRange)) {
      if (row.manifestVersions.includes(manifestVersion)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Return every `manifestVersion` readable by the supplied
 * `engineVersion` (deduplicated, insertion-ordered). Returns `[]` if no
 * row matches the engine — including malformed engine versions.
 */
export function readableManifestVersions(engineVersion: string): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of COMPATIBILITY_MATRIX) {
    if (satisfiesRange(engineVersion, row.engineRange)) {
      for (const mv of row.manifestVersions) {
        if (!seen.has(mv)) {
          seen.add(mv);
          out.push(mv);
        }
      }
    }
  }
  return out;
}

/**
 * Return every `CompatibilityRow` whose `engineRange` includes the
 * supplied `engineVersion`. Useful for tooling that wants to surface
 * the row's `note` field (e.g. `"your engine 2.5.0 reads
 * manifestVersion 1 (P16 launch row)"`). Returns `[]` for unmatched or
 * malformed engine versions.
 */
export function matchingRows(engineVersion: string): readonly CompatibilityRow[] {
  return COMPATIBILITY_MATRIX.filter((row) => satisfiesRange(engineVersion, row.engineRange));
}
