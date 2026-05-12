// packages/pack-format/src/signature.ts
// T-494 — Ed25519 detached-signature utilities for `.stageflip-pack`
// archives per ADR-012 §D3. Uses Node's built-in `node:crypto`
// Ed25519 primitives (Node 22 — workspace target); no external dep.
//
// Determinism perimeter: pack-format lives OUTSIDE per CLAUDE.md §3.
// Signing is host-side (publisher's machine); verifying is loader-side
// (tenant's machine). Both are Node.

import {
  type KeyObject,
  createPrivateKey,
  createPublicKey,
  sign as nodeSign,
  verify as nodeVerify,
} from 'node:crypto';

/**
 * Sign the supplied pack archive bytes with the supplied Ed25519
 * private key. Returns a 64-byte detached signature per ADR-012 §D3.
 *
 * The private key is typically loaded from a PEM file on the
 * publisher's signing host; the function accepts either a PEM string,
 * a raw `Buffer`, or a pre-parsed `KeyObject`.
 */
export function signPackArchive(
  archiveBytes: Uint8Array,
  privateKey: string | Buffer | KeyObject,
): Uint8Array {
  const key =
    typeof privateKey === 'string' || Buffer.isBuffer(privateKey)
      ? createPrivateKey(privateKey)
      : privateKey;
  // Node's `crypto.sign` for Ed25519 takes (algorithm: null, data, key)
  // — Ed25519 ignores the digest parameter (no separate hash step).
  const sig = nodeSign(null, archiveBytes, key);
  return new Uint8Array(sig);
}

/**
 * Verify the supplied detached signature against the archive bytes
 * + publisher public key. Returns `true` if the signature is valid,
 * `false` otherwise. Does NOT throw on invalid signature — the
 * caller surfaces the result via `LF-PACK-SIGNATURE-INVALID`.
 */
export function verifyPackArchive(
  archiveBytes: Uint8Array,
  signature: Uint8Array,
  publicKey: string | Buffer | KeyObject,
): boolean {
  const key =
    typeof publicKey === 'string' || Buffer.isBuffer(publicKey)
      ? createPublicKey(publicKey)
      : publicKey;
  return nodeVerify(null, archiveBytes, key, signature);
}

/**
 * Length-in-bytes of an Ed25519 detached signature. Used by the
 * pack-loader to assert the signature file is well-formed before
 * attempting verification.
 */
export const ED25519_SIGNATURE_LENGTH = 64;
