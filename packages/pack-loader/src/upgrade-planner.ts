// packages/pack-loader/src/upgrade-planner.ts
// T-540 — Pack upgrade planner. When the StageFlip engine bumps to a
// new platform version, every installed pack needs a compatibility
// check against the target. This module walks the set of installed
// packs (typically the success rows of `discoverPacks`) plus an
// optional catalogue of available pack versions, and produces an
// `UpgradePlan` summarising per-pack status + recommended action.
//
// Gate order per pack (each row short-circuits at the first match):
//   1. target engine doesn't list the pack's manifestVersion in any
//      COMPATIBILITY_MATRIX row → 'manifest-version-incompatible'
//   2. pack's manifest-declared platformCompatibility admits target
//      engine → 'compatible'
//   3. catalogue contains a newer version of the same publisher/id
//      whose platformCompatibility admits target engine AND whose
//      manifestVersion is readable by the target engine →
//      'needs-upgrade'
//   4. otherwise → 'blocked'
//
// This module emits PLANS, not INSTALLS. The actual upgrade install
// flow remains a separate concern (see install.ts stub).
//
// Determinism perimeter: `@stageflip/pack-loader` lives OUTSIDE per
// CLAUDE.md §3 (host-side tooling).

import {
  type PackManifest,
  isCompatible,
  readableManifestVersions,
  satisfiesRange,
} from '@stageflip/pack-format';

/**
 * One of four status verdicts produced by `planUpgrade` per row.
 *
 * - `compatible`                       pack's `platformCompatibility`
 *                                       admits the target engine and
 *                                       its `manifestVersion` is read
 *                                       by some matrix row.
 * - `needs-upgrade`                    pack's `platformCompatibility`
 *                                       does NOT admit the target
 *                                       engine, but a newer version of
 *                                       the same pack in the
 *                                       catalogue does.
 * - `blocked`                          pack is incompatible and no
 *                                       newer compatible version
 *                                       exists in the catalogue (or
 *                                       no catalogue was supplied).
 * - `manifest-version-incompatible`    target engine doesn't read this
 *                                       `manifestVersion` at all per
 *                                       the COMPATIBILITY_MATRIX.
 */
export type PackUpgradeStatus =
  | 'compatible'
  | 'needs-upgrade'
  | 'blocked'
  | 'manifest-version-incompatible';

/** One row of an `UpgradePlan`. */
export interface PackUpgradeRow {
  readonly publisherId: string;
  readonly packId: string;
  readonly currentVersion: string;
  readonly status: PackUpgradeStatus;
  readonly recommendedAction: string;
  readonly currentPlatformCompatibility: string;
}

/** One entry in the optional catalogue passed to `planUpgrade`. */
export interface CataloguePackVersion {
  readonly version: string;
  readonly platformCompatibility: string;
  readonly manifestVersion: string;
}

/** Input to `planUpgrade`. */
export interface UpgradePlanInput {
  /** Currently installed packs (typically `discoverPacks()` success rows). */
  readonly installed: readonly { manifest: PackManifest; installPath: string }[];
  /** Target engine version to plan against (e.g. `'3.0.0'`). */
  readonly targetEngineVersion: string;
  /**
   * Optional catalogue of available pack versions keyed by
   * `<publisherId>/<packId>`. When absent, every incompatible pack is
   * marked `blocked` (no upgrade path known).
   */
  readonly catalogue?: ReadonlyMap<string, readonly CataloguePackVersion[]>;
}

/** Output of `planUpgrade`. */
export interface UpgradePlan {
  readonly targetEngineVersion: string;
  readonly rows: readonly PackUpgradeRow[];
  readonly summary: {
    readonly compatible: number;
    readonly needsUpgrade: number;
    readonly blocked: number;
    readonly manifestVersionIncompatible: number;
  };
}

/** Stable key for catalogue lookup. */
export function catalogueKey(publisherId: string, packId: string): string {
  return `${publisherId}/${packId}`;
}

/**
 * Plan an upgrade of every installed pack against a target engine
 * version. Pure function: no IO, no Date, deterministic output for
 * deterministic input.
 */
export function planUpgrade(input: UpgradePlanInput): UpgradePlan {
  const targetReadableManifestVersions = readableManifestVersions(input.targetEngineVersion);
  const rows: PackUpgradeRow[] = input.installed.map(({ manifest }) =>
    classify(manifest, input.targetEngineVersion, targetReadableManifestVersions, input.catalogue),
  );

  let compatible = 0;
  let needsUpgrade = 0;
  let blocked = 0;
  let manifestVersionIncompatible = 0;
  for (const row of rows) {
    switch (row.status) {
      case 'compatible':
        compatible++;
        break;
      case 'needs-upgrade':
        needsUpgrade++;
        break;
      case 'blocked':
        blocked++;
        break;
      case 'manifest-version-incompatible':
        manifestVersionIncompatible++;
        break;
    }
  }

  return {
    targetEngineVersion: input.targetEngineVersion,
    rows,
    summary: {
      compatible,
      needsUpgrade,
      blocked,
      manifestVersionIncompatible,
    },
  };
}

function classify(
  manifest: PackManifest,
  targetEngineVersion: string,
  targetReadableManifestVersions: readonly string[],
  catalogue: ReadonlyMap<string, readonly CataloguePackVersion[]> | undefined,
): PackUpgradeRow {
  const publisherId = manifest.publisher.id;
  const packId = manifest.id;
  const currentVersion = manifest.version;
  const currentPlatformCompatibility = manifest.platformCompatibility;

  // Gate 1: target engine doesn't read this manifestVersion at all.
  if (!targetReadableManifestVersions.includes(manifest.manifestVersion)) {
    return {
      publisherId,
      packId,
      currentVersion,
      currentPlatformCompatibility,
      status: 'manifest-version-incompatible',
      recommendedAction: `Target engine ${targetEngineVersion} does not read manifestVersion ${manifest.manifestVersion}; await publisher repackage to a supported manifestVersion`,
    };
  }

  // Gate 2: pack's platformCompatibility admits the target engine.
  if (
    satisfiesRange(targetEngineVersion, currentPlatformCompatibility) &&
    isCompatible(targetEngineVersion, manifest.manifestVersion)
  ) {
    return {
      publisherId,
      packId,
      currentVersion,
      currentPlatformCompatibility,
      status: 'compatible',
      recommendedAction: '(none)',
    };
  }

  // Gate 3: catalogue contains a newer compatible version.
  const candidate = findUpgradeCandidate(
    publisherId,
    packId,
    currentVersion,
    targetEngineVersion,
    catalogue,
  );
  if (candidate !== null) {
    return {
      publisherId,
      packId,
      currentVersion,
      currentPlatformCompatibility,
      status: 'needs-upgrade',
      recommendedAction: `Install ${packId}@${candidate.version} (platformCompatibility ${candidate.platformCompatibility}) — compatible with engine ${targetEngineVersion}`,
    };
  }

  // Gate 4: no upgrade path known.
  return {
    publisherId,
    packId,
    currentVersion,
    currentPlatformCompatibility,
    status: 'blocked',
    recommendedAction: `No compatible version of ${publisherId}/${packId} found in catalogue for engine ${targetEngineVersion}; contact publisher`,
  };
}

/**
 * Find the highest catalogue version of the same pack that
 *   (a) is newer than the currently-installed version,
 *   (b) lists a `platformCompatibility` that admits `targetEngineVersion`, and
 *   (c) lists a `manifestVersion` readable by `targetEngineVersion`.
 * Returns `null` if no such candidate exists or no catalogue was supplied.
 */
function findUpgradeCandidate(
  publisherId: string,
  packId: string,
  currentVersion: string,
  targetEngineVersion: string,
  catalogue: ReadonlyMap<string, readonly CataloguePackVersion[]> | undefined,
): CataloguePackVersion | null {
  if (catalogue === undefined) return null;
  const candidates = catalogue.get(catalogueKey(publisherId, packId));
  if (candidates === undefined || candidates.length === 0) return null;

  let best: CataloguePackVersion | null = null;
  for (const cand of candidates) {
    if (compareSemver(cand.version, currentVersion) <= 0) continue;
    if (!satisfiesRange(targetEngineVersion, cand.platformCompatibility)) continue;
    if (!isCompatible(targetEngineVersion, cand.manifestVersion)) continue;
    if (best === null || compareSemver(cand.version, best.version) > 0) {
      best = cand;
    }
  }
  return best;
}

/**
 * Compare two semver-like `X.Y.Z` strings. Returns >0 / 0 / <0.
 * Lenient: unparseable strings sort as `0.0.0`. Sufficient for the
 * catalogue-sort use case; full semver lives in `@stageflip/pack-format`.
 */
function compareSemver(a: string, b: string): number {
  const pa = parseTriple(a);
  const pb = parseTriple(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

function parseTriple(s: string): {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
} {
  const match = s.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return { major: 0, minor: 0, patch: 0 };
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}
