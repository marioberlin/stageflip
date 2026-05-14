// packages/on-device-player-packaging/src/code-signing.ts
// Code-signing policy schema + binary signature verification (T-400).
// Mirrors `@stageflip/pack-signing` posture: publisher-key registry +
// TOFU pattern, ed25519 first-class (rsa-pss-sha256 supported for
// vendor / regulatory environments that mandate RSA).
//
// Per security-review-track-a §3 (R-11), the on-device-player binary's
// supply chain MUST verify signatures before executing newly-pulled
// artifacts. This module is the verification primitive; the binary's
// boot scaffold (`entrypoint.ts`) calls it after a fresh-download path.
//
// Determinism perimeter: this package lives OUTSIDE per CLAUDE.md §3.

import { createPublicKey, createVerify, verify as nodeVerify } from 'node:crypto';

import { z } from 'zod';

/**
 * Strict schema for the code-signing policy embedded in
 * `OnDeviceBinaryManifest.codeSigningPolicy`.
 *
 * `enforce`:
 *   - `'strict'` (default in stable channel): signature required + must
 *     verify against a trusted publisher key. Refuse boot otherwise.
 *   - `'warn'`  (suitable for canary / beta): refusal emitted as
 *     telemetry but boot proceeds. Consumer is expected to wire warning
 *     telemetry into an alerting pipeline.
 *   - `'off'`   (developer dev-loop only): verification skipped. NEVER
 *     used on production devices. The binary's boot scaffold logs a
 *     prominent warning when this mode is active.
 */
export const codeSigningPolicySchema = z
  .object({
    enforce: z.enum(['strict', 'warn', 'off']),
    trustedPublisherKeyIds: z.array(z.string().min(1)).min(1),
    signatureAlgorithm: z.enum(['ed25519', 'rsa-pss-sha256']),
    signatureUri: z.string().url(),
  })
  .strict();

export type CodeSigningPolicy = z.infer<typeof codeSigningPolicySchema>;

/**
 * Result of `verifyBinarySignature`. `verified === true` means the
 * binary is safe to execute under the supplied policy; `verified ===
 * false` carries a structured `reason` for telemetry attribution.
 *
 * The five reasons map 1:1 onto the failure paths in
 * `verifyBinarySignature`. `'verified'` is reserved for the success arm
 * + the `policy.enforce === 'off'` short-circuit.
 */
export interface SignatureVerifyResult {
  readonly verified: boolean;
  readonly reason:
    | 'verified'
    | 'signature-missing'
    | 'untrusted-publisher'
    | 'algorithm-mismatch'
    | 'signature-invalid';
}

/**
 * Publisher public key descriptor — caller-supplied, sourced from the
 * device's trusted-publisher registry (the production binary mirrors
 * `@stageflip/pack-signing`'s TOFU pattern: keys pinned at provisioning
 * time, rotated via signed manifest updates).
 */
export interface PublisherPublicKey {
  readonly keyId: string;
  readonly algorithm: 'ed25519' | 'rsa-pss-sha256';
  readonly publicKey: Uint8Array;
}

/** Arguments for `verifyBinarySignature`. */
export interface VerifyBinarySignatureArgs {
  readonly binaryBytes: Uint8Array;
  readonly signatureBytes: Uint8Array;
  readonly policy: CodeSigningPolicy;
  readonly publisherPublicKey: PublisherPublicKey;
}

/**
 * Verify a binary's detached signature against the supplied policy +
 * publisher public key. Pure verification — no I/O, no key fetch. The
 * caller is responsible for fetching the signature + locating the
 * pinned publisher key.
 *
 * Failure paths (in evaluation order):
 *   1. `policy.enforce === 'off'` → returns `{ verified: true, reason:
 *      'verified' }` unconditionally (operator opt-in dev mode).
 *   2. `signatureBytes.length === 0` → `'signature-missing'`.
 *   3. `policy.trustedPublisherKeyIds` does not contain
 *      `publisherPublicKey.keyId` → `'untrusted-publisher'`.
 *   4. `policy.signatureAlgorithm !== publisherPublicKey.algorithm` →
 *      `'algorithm-mismatch'`.
 *   5. Native crypto verify returns `false` → `'signature-invalid'`.
 *   6. Native crypto verify returns `true` → `'verified'`.
 */
export function verifyBinarySignature(args: VerifyBinarySignatureArgs): SignatureVerifyResult {
  // Arm 1 — explicit operator opt-out.
  if (args.policy.enforce === 'off') {
    return { verified: true, reason: 'verified' };
  }

  // Arm 2 — no signature supplied.
  if (args.signatureBytes.length === 0) {
    return { verified: false, reason: 'signature-missing' };
  }

  // Arm 3 — publisher key not in the trust set.
  if (!args.policy.trustedPublisherKeyIds.includes(args.publisherPublicKey.keyId)) {
    return { verified: false, reason: 'untrusted-publisher' };
  }

  // Arm 4 — declared policy algorithm does not match the key's algorithm.
  if (args.policy.signatureAlgorithm !== args.publisherPublicKey.algorithm) {
    return { verified: false, reason: 'algorithm-mismatch' };
  }

  // Arm 5 + 6 — actual crypto verify.
  const keyObject = createPublicKey({
    key: Buffer.from(args.publisherPublicKey.publicKey),
    format: 'der',
    type: 'spki',
  });

  let ok: boolean;
  if (args.policy.signatureAlgorithm === 'ed25519') {
    // Ed25519 — `crypto.verify(null, data, key, sig)`; ignores the digest.
    ok = nodeVerify(null, args.binaryBytes, keyObject, args.signatureBytes);
  } else {
    // RSA-PSS-SHA256 — explicit padding + saltLength via Verify object.
    const verifier = createVerify('sha256');
    verifier.update(args.binaryBytes);
    verifier.end();
    ok = verifier.verify(
      {
        key: keyObject,
        padding: 6, // RSA_PKCS1_PSS_PADDING — Node constant value.
        saltLength: 32, // -2 == RSA_PSS_SALTLEN_DIGEST; explicit 32 = SHA-256 digest length.
      },
      Buffer.from(args.signatureBytes),
    );
  }

  return ok
    ? { verified: true, reason: 'verified' }
    : { verified: false, reason: 'signature-invalid' };
}
