// packages/pack-wedding-events/src/manifest.ts
// T-528 — `Wedding & Events` pack manifest. Single source of truth for
// the `@stageflip/pack-wedding-events` content package per ADR-012 §D2
// (manifest schema) + ADR-013 §D3 (paid-per-tenant commercial-
// subscription tier).
//
// The skeleton ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// Seven preset contributions: three substantive theme variants from
// T-527 (rustic / modern / classic) + two substantive composition
// templates from T-528 (wedding-ceremony-template +
// wedding-reception-template, both binding cluster-D `titleSequence`
// + cluster-A `lowerThird` via PRESET_ID_BINDINGS Pattern C) + two
// placeholder slots reserved for the remaining wedding-events-vertical
// content extensions (T-529 wedding-specific transitions + bumpers,
// T-530 pre-licensed audio bed library). All seven entries declare the
// `cluster-wedding-events` vertical-use-case cluster — `cluster` is a
// free-form string in the manifest schema (`z.string().min(1)`), so
// declaring a new vertical-use-case cluster is purely a content-side
// metadata operation: it does NOT introduce a new clipKind in clip
// code and does NOT require allowlist updates to `check-skill-drift`
// (which walks `skills/stageflip/presets/<cluster>/` directories, not
// pack manifests). The skeleton is buildable + signable end-to-end so
// the pack-integrity gate exercises the real pipeline from day one.
//
// Unlike News Pro (cluster-a — broadcaster-brand registers), Sports
// Networks (cluster-b — league-brand registers), and Creator Style
// (cluster-f — creator-brand registers), the Wedding & Events Pack —
// like Earnings & Investor (cluster-finance) before it — is
// vertical-use-case oriented: theme variants, composition templates,
// transitions + bumpers, and a pre-licensed audio bed library for the
// wedding-events use case.
//
// Determinism perimeter: `@stageflip/pack-wedding-events` lives
// OUTSIDE per CLAUDE.md §3 — content packages are NOT in the
// perimeter, and this module is consumed by host-side tooling only.

import type { PackManifest } from '@stageflip/pack-format';

/** Placeholder hash used until `scripts/build-pack.ts` computes the real one. */
export const PLACEHOLDER_INTEGRITY_HASH = '0'.repeat(64);

/**
 * The Wedding & Events pack manifest, expressed as a TypeScript
 * object so the editor surface can typecheck against it and so
 * `scripts/build-pack.ts` has a single source of truth to render into
 * `manifest.json`.
 *
 * NOTE: `integrity.hash` is the placeholder zeroes until the build
 * script substitutes the real SHA-256 of the synthesized archive.
 */
export const MANIFEST_SKELETON: PackManifest = {
  manifestVersion: '1',
  id: 'wedding-events',
  name: 'Wedding & Events',
  version: '0.1.0',
  publisher: {
    id: 'stageflip',
    displayName: 'StageFlip',
  },
  platformCompatibility: '^2.0.0',
  license: {
    kind: 'paid-per-tenant',
    sku: 'wedding-events-1y',
    entitlementType: 'subscription',
  },
  integrity: {
    algorithm: 'sha256',
    hash: PLACEHOLDER_INTEGRITY_HASH,
  },
  contributes: {
    presets: [
      { id: 'rustic-theme', cluster: 'cluster-wedding-events' },
      { id: 'modern-theme', cluster: 'cluster-wedding-events' },
      { id: 'classic-theme', cluster: 'cluster-wedding-events' },
      { id: 'wedding-ceremony-template', cluster: 'cluster-wedding-events' },
      { id: 'wedding-reception-template', cluster: 'cluster-wedding-events' },
      { id: 'wedding-transitions-placeholder', cluster: 'cluster-wedding-events' },
      { id: 'audio-bed-library-placeholder', cluster: 'cluster-wedding-events' },
    ],
  },
  description:
    'Premium wedding & events templates extending a new wedding-events-vertical cluster — three substantive theme variants from T-527 (rustic / modern / classic, all wiring the T-183 LowerThird primitive), two substantive composition templates from T-528 (wedding-ceremony-template + wedding-reception-template, both binding cluster-D titleSequence + cluster-A lowerThird via PRESET_ID_BINDINGS Pattern C cross-cluster register reuse — same model T-520 / T-522 / T-523 established), wedding-specific transitions + bumpers (T-529), and a pre-licensed audio bed library (T-530).',
  homepage: 'https://stageflip.dev/packs/wedding-events',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-wedding-events',
  keywords: [
    'wedding',
    'events',
    'lifecycle',
    'audio',
    'cluster-wedding-events',
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
