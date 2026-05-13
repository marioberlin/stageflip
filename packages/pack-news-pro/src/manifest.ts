// packages/pack-news-pro/src/manifest.ts
// T-506 — `News Pro` pack manifest skeleton. Single source of truth
// for the `@stageflip/pack-news-pro` content package per ADR-012 §D2
// (manifest schema) + ADR-013 §D3 (paid-per-tenant commercial tier).
//
// The skeleton ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// Three placeholder preset contributions reserve the cluster-A entries
// that T-507 / T-508 / T-509 fill in.
//
// Determinism perimeter: `@stageflip/pack-news-pro` lives OUTSIDE per
// CLAUDE.md §3 — content packages are NOT in the perimeter, and this
// module is consumed by host-side tooling only.

import type { PackManifest } from '@stageflip/pack-format';

/** Placeholder hash used until `scripts/build-pack.ts` computes the real one. */
export const PLACEHOLDER_INTEGRITY_HASH = '0'.repeat(64);

/**
 * The News Pro pack manifest, expressed as a TypeScript object so the
 * editor surface can typecheck against it and so `scripts/build-pack.ts`
 * has a single source of truth to render into `manifest.json`.
 *
 * NOTE: `integrity.hash` is the placeholder zeroes until the build
 * script substitutes the real SHA-256 of the synthesized archive.
 */
export const MANIFEST_SKELETON: PackManifest = {
  manifestVersion: '1',
  id: 'news-pro',
  name: 'News Pro',
  version: '0.1.0',
  publisher: {
    id: 'stageflip',
    displayName: 'StageFlip',
  },
  platformCompatibility: '^2.0.0',
  license: {
    kind: 'paid-per-tenant',
    sku: 'news-pro-1y',
    entitlementType: 'subscription',
  },
  integrity: {
    algorithm: 'sha256',
    hash: PLACEHOLDER_INTEGRITY_HASH,
  },
  contributes: {
    presets: [
      { id: 'sky-news-pro-register', cluster: 'cluster-a' },
      { id: 'itv-pro-register', cluster: 'cluster-a' },
      { id: 'rai-pro-register', cluster: 'cluster-a' },
    ],
  },
  description:
    'Premium broadcast-news templates extending Cluster A — register variants for Sky News, ITV, RAI plus premium news-ticker preset (filled in by T-507..T-510).',
  homepage: 'https://stageflip.dev/packs/news-pro',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-news-pro',
  keywords: ['news', 'broadcast', 'ticker', 'cluster-a', 'stageflip-first-party'],
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
