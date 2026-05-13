// packages/pack-loader/src/load-pack.ts
// T-495 — Single-pack loader entry. Reads an installed pack directory,
// runs every install-time gate per ADR-012 §D6, and either returns a
// typed `PackInstallation` (ready to register with the engine) or a
// `PackLoadFailure` carrying one of the 5 LF-* loss flag codes.
//
// Gate order (each gate short-circuits on failure):
//   1. manifest.json read + Zod parse        → LF-PACK-MANIFEST-PARSE-ERROR
//   2a. platformCompatibility semver-range   → LF-PACK-INCOMPATIBLE-VERSION
//   2b. compatibility-matrix lookup (T-502)  → LF-PACK-INCOMPATIBLE-VERSION
//   3. archive.tar.zst + signature.bin read  → LF-PACK-MANIFEST-PARSE-ERROR
//                                              (missing archive treated as
//                                              malformed install)
//   4. Ed25519 signature verify              → LF-PACK-SIGNATURE-INVALID
//   5. Entitlement check (paid + enterprise) → LF-LICENSE-PACK-DENIED
//
// The runtime clip-mount gate (per §D6 point 2) lives in renderer-core
// (T-497) and emits LF-LICENSE-CLIP-REVOKED.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ED25519_SIGNATURE_LENGTH,
  type PackFormatLossFlagCode,
  type PackManifest,
  isCompatible,
  parsePackManifest,
  satisfiesRange,
  verifyPackArchive,
} from '@stageflip/pack-format';

import { type PackLoaderDependencies, requiresEntitlement } from './dependencies.js';

/**
 * Layout of an installed pack on disk per ADR-012 §D8:
 *   <installPath>/manifest.json
 *   <installPath>/archive.tar.zst
 *   <installPath>/signature.bin
 */
const MANIFEST_FILENAME = 'manifest.json';
const ARCHIVE_FILENAME = 'archive.tar.zst';
const SIGNATURE_FILENAME = 'signature.bin';

/** A successfully-loaded pack, ready for engine registration. */
export interface PackInstallation {
  readonly manifest: PackManifest;
  readonly installPath: string;
  readonly archiveBytes: Uint8Array;
}

/**
 * A failed pack load. Carries one of the 5 LF-* codes from
 * `@stageflip/pack-format` + a human-readable detail string for
 * inclusion in the loss-flag report or install-time UI.
 */
export interface PackLoadFailure {
  readonly reason: PackFormatLossFlagCode;
  readonly detail: string;
}

/** Discriminator helper for callers. */
export function isPackLoadFailure(
  result: PackInstallation | PackLoadFailure,
): result is PackLoadFailure {
  return 'reason' in result;
}

/**
 * Load a single pack installation from disk and run every install-time
 * gate. Returns the typed `PackInstallation` on success or a
 * `PackLoadFailure` carrying the LF-* code for the first gate that
 * failed (gates short-circuit).
 */
export async function loadPack(
  installPath: string,
  deps: PackLoaderDependencies,
): Promise<PackInstallation | PackLoadFailure> {
  // ── Gate 1: manifest.json read + Zod parse
  let manifest: PackManifest;
  try {
    const raw = await readFile(join(installPath, MANIFEST_FILENAME), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    manifest = parsePackManifest(parsed);
  } catch (err) {
    return {
      reason: 'LF-PACK-MANIFEST-PARSE-ERROR',
      detail: errorDetail(err),
    };
  }

  // ── Gate 2a: platformCompatibility semver-range (manifest-declared)
  if (!satisfiesRange(deps.platformVersion, manifest.platformCompatibility)) {
    return {
      reason: 'LF-PACK-INCOMPATIBLE-VERSION',
      detail: `platform ${deps.platformVersion} does not satisfy manifest platformCompatibility ${manifest.platformCompatibility}`,
    };
  }

  // ── Gate 2b: workspace compatibility-matrix lookup (T-502).
  // The matrix is the workspace-wide authoritative table of which
  // engine versions support which `manifestVersion` schemas. Even if a
  // pack's manifest-declared `platformCompatibility` admits the host
  // engine, the matrix is an additional check: if the engine doesn't
  // appear in any row that lists this `manifestVersion`, the runtime
  // can't safely load the pack. Currently dormant — `manifestVersion`
  // is constrained to `'1'` by `packManifestSchema`'s `z.literal('1')`,
  // and the single matrix row covers `>=2.0.0 → ['1']`, so no real
  // input can fail this gate. Active when `manifestVersion: '2'` ships.
  if (!isCompatible(deps.platformVersion, manifest.manifestVersion)) {
    return {
      reason: 'LF-PACK-INCOMPATIBLE-VERSION',
      detail: `engine ${deps.platformVersion} does not list manifestVersion ${manifest.manifestVersion} in the workspace compatibility matrix`,
    };
  }

  // ── Gate 3: archive.tar.zst + signature.bin read
  let archiveBytes: Uint8Array;
  let signature: Uint8Array;
  try {
    const [archiveBuf, signatureBuf] = await Promise.all([
      readFile(join(installPath, ARCHIVE_FILENAME)),
      readFile(join(installPath, SIGNATURE_FILENAME)),
    ]);
    archiveBytes = new Uint8Array(archiveBuf);
    signature = new Uint8Array(signatureBuf);
  } catch (err) {
    return {
      reason: 'LF-PACK-MANIFEST-PARSE-ERROR',
      detail: `failed to read archive or signature: ${errorDetail(err)}`,
    };
  }

  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    return {
      reason: 'LF-PACK-SIGNATURE-INVALID',
      detail: `signature length ${signature.length} (expected ${ED25519_SIGNATURE_LENGTH})`,
    };
  }

  // ── Gate 4: Ed25519 verify
  const publisherKey = await deps.publisherKeys.getPublisherKey(manifest.publisher.id);
  if (publisherKey === null) {
    return {
      reason: 'LF-PACK-SIGNATURE-INVALID',
      detail: `no publisher key registered for ${manifest.publisher.id}`,
    };
  }
  let signatureValid: boolean;
  try {
    signatureValid = verifyPackArchive(archiveBytes, signature, publisherKey);
  } catch (err) {
    return {
      reason: 'LF-PACK-SIGNATURE-INVALID',
      detail: `verify threw: ${errorDetail(err)}`,
    };
  }
  if (!signatureValid) {
    return {
      reason: 'LF-PACK-SIGNATURE-INVALID',
      detail: `signature did not verify against publisher ${manifest.publisher.id}`,
    };
  }

  // ── Gate 5: Entitlement check
  if (requiresEntitlement(manifest.license)) {
    // narrow off the open variant
    const license = manifest.license;
    if (license.kind === 'open') {
      // unreachable per requiresEntitlement; satisfies the typechecker
      return { manifest, installPath, archiveBytes };
    }
    const entitlement = await deps.entitlements.getEntitlement(license.sku);
    if (entitlement === null) {
      return {
        reason: 'LF-LICENSE-PACK-DENIED',
        detail: `no entitlement for sku ${license.sku}`,
      };
    }
    if (entitlement.status !== 'active') {
      return {
        reason: 'LF-LICENSE-PACK-DENIED',
        detail: `entitlement for sku ${license.sku} is ${entitlement.status}`,
      };
    }
  }

  return { manifest, installPath, archiveBytes };
}

function errorDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
