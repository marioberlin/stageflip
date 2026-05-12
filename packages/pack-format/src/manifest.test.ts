// packages/pack-format/src/manifest.test.ts
// Unit tests for the pack manifest schema (T-494).

import { describe, expect, it } from 'vitest';

import {
  type PackManifest,
  PackManifestParseError,
  packManifestSchema,
  parsePackManifest,
} from './manifest.js';

const VALID_MANIFEST: PackManifest = {
  manifestVersion: '1',
  id: 'news-pro',
  name: 'News Pro',
  version: '1.0.0',
  publisher: { id: 'stageflip', displayName: 'StageFlip Inc.' },
  platformCompatibility: '^16.0.0',
  license: { kind: 'paid-per-tenant', sku: 'news-pro-monthly', entitlementType: 'subscription' },
  integrity: {
    algorithm: 'sha256',
    hash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  },
  contributes: { presets: [{ id: 'breaking-banner', cluster: 'news' }] },
};

describe('packManifestSchema', () => {
  it('accepts a fully-populated valid manifest', () => {
    expect(() => packManifestSchema.parse(VALID_MANIFEST)).not.toThrow();
  });

  it('accepts an open-license claim with SPDX', () => {
    const open: PackManifest = {
      ...VALID_MANIFEST,
      license: { kind: 'open', spdx: 'MIT' },
    };
    expect(() => packManifestSchema.parse(open)).not.toThrow();
  });

  it('accepts an enterprise claim with optional contractRef', () => {
    const ent: PackManifest = {
      ...VALID_MANIFEST,
      license: { kind: 'enterprise', sku: 'custom-deck-pack', contractRef: 'ACME-2026-Q2' },
    };
    expect(() => packManifestSchema.parse(ent)).not.toThrow();
  });

  it('rejects unknown top-level fields (.strict)', () => {
    expect(() => packManifestSchema.parse({ ...VALID_MANIFEST, foo: 'bar' })).toThrow();
  });

  it('rejects malformed id (must be kebab-case)', () => {
    expect(() => packManifestSchema.parse({ ...VALID_MANIFEST, id: 'NotKebab' })).toThrow();
  });

  it('rejects non-semver version', () => {
    expect(() => packManifestSchema.parse({ ...VALID_MANIFEST, version: 'v1' })).toThrow();
  });

  it('rejects malformed integrity hash (must be 64-char hex)', () => {
    expect(() =>
      packManifestSchema.parse({
        ...VALID_MANIFEST,
        integrity: { algorithm: 'sha256', hash: 'too-short' },
      }),
    ).toThrow();
  });

  it('rejects integrity algorithm other than sha256', () => {
    expect(() =>
      packManifestSchema.parse({
        ...VALID_MANIFEST,
        integrity: { algorithm: 'sha512', hash: '0'.repeat(64) },
      }),
    ).toThrow();
  });

  it('rejects unknown license.kind', () => {
    expect(() =>
      packManifestSchema.parse({
        ...VALID_MANIFEST,
        license: { kind: 'mystery', sku: 'x' },
      }),
    ).toThrow();
  });

  it('rejects manifestVersion other than "1"', () => {
    expect(() => packManifestSchema.parse({ ...VALID_MANIFEST, manifestVersion: '2' })).toThrow();
  });

  it('rejects empty contributes is allowed (optional fields)', () => {
    expect(() => packManifestSchema.parse({ ...VALID_MANIFEST, contributes: {} })).not.toThrow();
  });

  it('accepts all 8 contribution kinds', () => {
    const full: PackManifest = {
      ...VALID_MANIFEST,
      contributes: {
        presets: [{ id: 'p1', cluster: 'news' }],
        clipKinds: [{ kind: 'three-scene', module: 'foo#Bar' }],
        fonts: [{ family: 'Inter', license: 'ofl' }],
        fixtures: [{ id: 'p1' }],
        assets: [{ path: 'logo.png', mimeType: 'image/png' }],
        tools: [{ bundleName: 'cluster-x-compose', tools: ['compose_x'] }],
        adapters: [{ id: 'audience-acme', modality: 'audience-backend' }],
        themePacks: [{ id: 'news-night' }],
      },
    };
    expect(() => packManifestSchema.parse(full)).not.toThrow();
  });
});

describe('parsePackManifest', () => {
  it('returns the typed PackManifest on valid input', () => {
    const out = parsePackManifest(VALID_MANIFEST);
    expect(out.id).toBe('news-pro');
  });

  it('throws PackManifestParseError on invalid input', () => {
    expect(() => parsePackManifest({ ...VALID_MANIFEST, id: 'INVALID' })).toThrow(
      PackManifestParseError,
    );
  });
});
