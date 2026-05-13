// packages/pack-wedding-events/src/manifest.ts
// T-530 — `Wedding & Events` pack manifest. Single source of truth for
// the `@stageflip/pack-wedding-events` content package per ADR-012 §D2
// (manifest schema) + ADR-013 §D3 (paid-per-tenant commercial-
// subscription tier).
//
// The manifest ships with `integrity.hash` as 64 zeroes; the
// orchestrator-run `scripts/build-pack.ts` rewrites the `integrity.hash`
// to match SHA-256 over the synthesized archive bytes before signing.
// All ten preset contributions are now substantive — three theme
// variants from T-527 (rustic / modern / classic) + two composition
// templates from T-528 (wedding-ceremony-template +
// wedding-reception-template, both binding cluster-D `titleSequence` +
// cluster-A `lowerThird` via PRESET_ID_BINDINGS Pattern C) + four
// transition / bumper presets from T-529 (petal-cross-fade-transition +
// lace-wipe-transition forward-reference a candidate `transition`
// clipKind that does not yet exist in the workspace;
// wedding-bumper-card + wedding-final-card bind cluster-D
// `titleSequence` via PRESET_ID_BINDINGS Pattern C) + the
// pre-licensed audio bed library from T-530 (`audio-bed-library`).
// T-530 additionally seeds the manifest's `contributes.assets` array
// with the five pre-licensed audio bed track references per ADR-012
// §D5 — the actual MP3 bytes are NOT shipped in the pack archive
// (per-tenant external delivery due to mechanical-licensing terms),
// documented as a Trade-off in the preset markdown. All ten entries
// declare the `cluster-wedding-events` vertical-use-case cluster —
// `cluster` is a free-form string in the manifest schema
// (`z.string().min(1)`), so declaring a new vertical-use-case cluster
// is purely a content-side metadata operation: it does NOT introduce a
// new clipKind in clip code and does NOT require allowlist updates to
// `check-skill-drift` (which walks `skills/stageflip/presets/<cluster>/`
// directories, not pack manifests). T-530 bumps the pack version
// 0.1.0 → 0.2.0 (additive — new assets contribution + final placeholder
// slot filled) and closes the Wedding & Events launch pack at v0.2.0
// GA.
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
  version: '0.2.0',
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
      { id: 'petal-cross-fade-transition', cluster: 'cluster-wedding-events' },
      { id: 'lace-wipe-transition', cluster: 'cluster-wedding-events' },
      { id: 'wedding-bumper-card', cluster: 'cluster-wedding-events' },
      { id: 'wedding-final-card', cluster: 'cluster-wedding-events' },
      { id: 'audio-bed-library', cluster: 'cluster-wedding-events' },
    ],
    assets: [
      {
        path: 'audio/processional-strings-instrumental.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        path: 'audio/recessional-uptempo-instrumental.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        path: 'audio/reception-jazz-ambient.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        path: 'audio/first-dance-acoustic-instrumental.mp3',
        mimeType: 'audio/mpeg',
      },
      {
        path: 'audio/closing-piano-instrumental.mp3',
        mimeType: 'audio/mpeg',
      },
    ],
  },
  description:
    'Premium wedding & events templates extending the cluster-wedding-events vertical cluster — three substantive theme variants from T-527 (rustic / modern / classic, all wiring the T-183 LowerThird primitive), two substantive composition templates from T-528 (wedding-ceremony-template + wedding-reception-template, both binding cluster-D titleSequence + cluster-A lowerThird via PRESET_ID_BINDINGS Pattern C cross-cluster register reuse — same model T-520 / T-522 / T-523 established), four substantive transition / bumper presets from T-529 (petal-cross-fade-transition + lace-wipe-transition forward-reference a candidate `transition` clipKind; wedding-bumper-card + wedding-final-card bind cluster-D titleSequence), and a pre-licensed audio bed library from T-530 (five pre-licensed instrumental tracks declared in contributes.assets — processional strings, uptempo recessional, jazz reception ambient, acoustic first-dance, piano closing — with actual audio bytes delivered per-tenant externally under mechanical-licensing terms, NOT shipped in the pack archive). v0.2.0 GA.',
  homepage: 'https://stageflip.dev/packs/wedding-events',
  repository: 'https://github.com/marioberlin/stageflip/tree/main/packages/pack-wedding-events',
  keywords: [
    'wedding',
    'events',
    'lifecycle',
    'audio',
    'audio-bed',
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
  if (MANIFEST_SKELETON.contributes.assets !== undefined) {
    out.contributes = {
      ...out.contributes,
      assets: MANIFEST_SKELETON.contributes.assets.map((a) => ({ ...a })),
    };
  }
  if (MANIFEST_SKELETON.keywords !== undefined) {
    out.keywords = [...MANIFEST_SKELETON.keywords];
  }
  return out;
}
