// packages/pack-sports-networks/src/manifest.ts
// T-511 — `Sports Networks` pack manifest skeleton. Single source of
// truth for the `@stageflip/pack-sports-networks` content package per
// ADR-012 §D2 (manifest schema) + ADR-013 §D3 (paid-per-tenant
// commercial-subscription tier).
//
// The skeleton ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// Five substantive preset contributions cover the cluster-B Sports
// Networks pack v0.2.0 contributions: four register variants — NBA Pro
// (T-512), NFL Pro (T-513), MLB (T-514), F1 Pro (T-515) — plus the
// closing AR formations grid-lineup integration (T-515; arOverlay
// clipKind, AR-bundle companion to the F1 Pro register). All slots are
// substantive — no placeholders remain after T-515.
//
// Determinism perimeter: `@stageflip/pack-sports-networks` lives
// OUTSIDE per CLAUDE.md §3 — content packages are NOT in the
// perimeter, and this module is consumed by host-side tooling only.

import type { PackManifest } from '@stageflip/pack-format';

/** Placeholder hash used until `scripts/build-pack.ts` computes the real one. */
export const PLACEHOLDER_INTEGRITY_HASH = '0'.repeat(64);

/**
 * The Sports Networks pack manifest, expressed as a TypeScript object
 * so the editor surface can typecheck against it and so
 * `scripts/build-pack.ts` has a single source of truth to render into
 * `manifest.json`.
 *
 * NOTE: `integrity.hash` is the placeholder zeroes until the build
 * script substitutes the real SHA-256 of the synthesized archive.
 */
export const MANIFEST_SKELETON: PackManifest = {
  manifestVersion: '1',
  id: 'sports-networks',
  name: 'Sports Networks',
  version: '0.2.0',
  publisher: {
    id: 'stageflip',
    displayName: 'StageFlip',
  },
  platformCompatibility: '^2.0.0',
  license: {
    kind: 'paid-per-tenant',
    sku: 'sports-networks-1y',
    entitlementType: 'subscription',
  },
  integrity: {
    algorithm: 'sha256',
    hash: PLACEHOLDER_INTEGRITY_HASH,
  },
  contributes: {
    presets: [
      { id: 'nba-pro-register', cluster: 'cluster-b' },
      { id: 'nfl-pro-register', cluster: 'cluster-b' },
      { id: 'mlb-register', cluster: 'cluster-b' },
      { id: 'f1-pro-register', cluster: 'cluster-b' },
      { id: 'f1-ar-grid-lineup', cluster: 'cluster-b' },
    ],
  },
  description:
    'Premium sports-broadcast templates extending Cluster B — register variants for NBA Pro, NFL Pro, MLB, F1 Pro (driver-position timing tower) plus the F1 AR grid-lineup overlay (pre-race grid-walk AR-bundle integration). Closes the Sports Networks pack at v0.2.0 GA.',
  homepage: 'https://stageflip.dev/packs/sports-networks',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-sports-networks',
  keywords: [
    'sports',
    'broadcast',
    'score-bug',
    'ar-overlay',
    'f1',
    'nba',
    'nfl',
    'mlb',
    'cluster-b',
    'stageflip-first-party',
  ],
};

/**
 * Return a deep clone of `MANIFEST_SKELETON` with `integrity.hash`
 * replaced by `hashHex`. Pure: does not mutate the skeleton.
 *
 * @param hashHex 64-character lowercase hex SHA-256 digest.
 */
export function withIntegrityHash(hashHex: string): PackManifest {
  const out: PackManifest = {
    ...MANIFEST_SKELETON,
    publisher: { ...MANIFEST_SKELETON.publisher },
    license: { ...MANIFEST_SKELETON.license },
    integrity: { algorithm: 'sha256', hash: hashHex },
    contributes: {
      ...MANIFEST_SKELETON.contributes,
    },
  };
  if (MANIFEST_SKELETON.contributes.presets !== undefined) {
    out.contributes = {
      ...out.contributes,
      presets: MANIFEST_SKELETON.contributes.presets.map((p) => ({ ...p })),
    };
  }
  if (MANIFEST_SKELETON.keywords !== undefined) {
    out.keywords = [...MANIFEST_SKELETON.keywords];
  }
  return out;
}
