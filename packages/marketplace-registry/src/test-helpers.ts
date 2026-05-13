// packages/marketplace-registry/src/test-helpers.ts
// T-536 — Shared test scaffolding: keypair generation, manifest +
// signed-archive synthesis, and a `RegistryDeps` factory wrapping the
// three in-memory stores. Pure helpers; no fs / no network.

import { generateKeyPairSync } from 'node:crypto';

import { signPackArchive } from '@stageflip/pack-format';
import { synthesizeArchive } from '@stageflip/pack-signing';

import { InMemoryTokenStore } from './auth/tokens.js';
import { InMemoryPublisherKeyRegistry } from './publishers/registry.js';
import type { RegistryDeps } from './routes/types.js';
import { InMemoryStorageAdapter } from './storage/in-memory.js';

/** Generate a fresh Ed25519 keypair as PEM strings. */
export function makeKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** Manifest overrides for `makeMinimalManifest`. */
export interface MinimalManifestOptions {
  readonly id?: string;
  readonly version?: string;
  readonly publisherId?: string;
  readonly publisherDisplayName?: string;
  readonly license?: Record<string, unknown>;
}

/** Build a minimal valid manifest object. */
export function makeMinimalManifest(opts: MinimalManifestOptions = {}): Record<string, unknown> {
  return {
    manifestVersion: '1',
    id: opts.id ?? 'demo',
    name: 'demo',
    version: opts.version ?? '1.0.0',
    publisher: {
      id: opts.publisherId ?? 'stageflip',
      displayName: opts.publisherDisplayName ?? 'StageFlip Inc.',
    },
    platformCompatibility: '^2.0.0',
    license: opts.license ?? { kind: 'open', spdx: 'MIT' },
    integrity: { algorithm: 'sha256', hash: '0'.repeat(64) },
    contributes: {},
  };
}

/** Result of `makeSignedPack`. */
export interface SignedPack {
  readonly manifest: Record<string, unknown>;
  readonly archiveBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
  readonly publicKeyPem: string;
  readonly privateKeyPem: string;
  readonly archiveBase64: string;
  readonly signatureBase64: string;
}

/**
 * Build a signed pack ready to POST to `/api/v1/packs`. Generates a
 * fresh keypair, synthesizes a deterministic archive containing the
 * manifest, signs the archive, and returns everything base64-encoded.
 */
export function makeSignedPack(opts: MinimalManifestOptions = {}): SignedPack {
  const manifest = makeMinimalManifest(opts);
  const archiveBytes = synthesizeArchive([
    {
      path: 'manifest.json',
      content: new TextEncoder().encode(JSON.stringify(manifest)),
    },
    {
      path: 'assets/hello.txt',
      content: new TextEncoder().encode('hello world'),
    },
  ]);
  const { privateKeyPem, publicKeyPem } = makeKeyPair();
  const signatureBytes = signPackArchive(archiveBytes, privateKeyPem);
  return {
    manifest,
    archiveBytes,
    signatureBytes,
    publicKeyPem,
    privateKeyPem,
    archiveBase64: Buffer.from(archiveBytes).toString('base64'),
    signatureBase64: Buffer.from(signatureBytes).toString('base64'),
  };
}

/** Assemble in-memory `RegistryDeps` with optional pre-seeded tokens. */
export function makeRegistryDeps(opts?: {
  tokens?: readonly { token: string; publisherId: string }[];
}): RegistryDeps & {
  storage: InMemoryStorageAdapter;
  publishers: InMemoryPublisherKeyRegistry;
  tokens: InMemoryTokenStore;
} {
  return {
    storage: new InMemoryStorageAdapter(),
    publishers: new InMemoryPublisherKeyRegistry(),
    tokens: new InMemoryTokenStore(opts?.tokens),
  };
}
