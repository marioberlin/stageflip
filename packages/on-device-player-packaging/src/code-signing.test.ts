// packages/on-device-player-packaging/src/code-signing.test.ts
// Tests for `verifyBinarySignature` — real Node `node:crypto` round-trips
// so the verification logic is exercised end-to-end (no mocked crypto).

import { createSign, generateKeyPairSync, sign as nodeSign } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  type CodeSigningPolicy,
  type PublisherPublicKey,
  verifyBinarySignature,
} from './code-signing.js';

const BINARY_BYTES = new TextEncoder().encode('the on-device player binary');

function makeEd25519KeyAndSig(): {
  publisherKey: PublisherPublicKey;
  signatureBytes: Uint8Array;
} {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
  const signature = nodeSign(null, BINARY_BYTES, privateKey);
  return {
    publisherKey: {
      keyId: 'test-publisher-2026',
      algorithm: 'ed25519',
      publicKey: new Uint8Array(publicKeyDer),
    },
    signatureBytes: new Uint8Array(signature),
  };
}

function makeRsaPssKeyAndSig(): {
  publisherKey: PublisherPublicKey;
  signatureBytes: Uint8Array;
} {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
  const signer = createSign('sha256');
  signer.update(BINARY_BYTES);
  signer.end();
  const signature = signer.sign({
    key: privateKey,
    padding: 6, // RSA_PKCS1_PSS_PADDING
    saltLength: 32,
  });
  return {
    publisherKey: {
      keyId: 'test-publisher-rsa-2026',
      algorithm: 'rsa-pss-sha256',
      publicKey: new Uint8Array(publicKeyDer),
    },
    signatureBytes: new Uint8Array(signature),
  };
}

const STRICT_ED25519_POLICY: CodeSigningPolicy = {
  enforce: 'strict',
  trustedPublisherKeyIds: ['test-publisher-2026'],
  signatureAlgorithm: 'ed25519',
  signatureUri: 'https://updates.example.com/on-device-player.sig',
};

describe('verifyBinarySignature — happy path (ed25519)', () => {
  it('returns { verified: true, reason: "verified" } for a valid signature', () => {
    const { publisherKey, signatureBytes } = makeEd25519KeyAndSig();
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes,
      policy: STRICT_ED25519_POLICY,
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: true, reason: 'verified' });
  });
});

describe('verifyBinarySignature — happy path (rsa-pss-sha256)', () => {
  it('returns { verified: true, reason: "verified" } for a valid RSA-PSS signature', () => {
    const { publisherKey, signatureBytes } = makeRsaPssKeyAndSig();
    const policy: CodeSigningPolicy = {
      enforce: 'strict',
      trustedPublisherKeyIds: ['test-publisher-rsa-2026'],
      signatureAlgorithm: 'rsa-pss-sha256',
      signatureUri: 'https://updates.example.com/on-device-player.sig',
    };
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes,
      policy,
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: true, reason: 'verified' });
  });
});

describe('verifyBinarySignature — refusal arms', () => {
  it('returns signature-missing when signatureBytes is empty', () => {
    const { publisherKey } = makeEd25519KeyAndSig();
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes: new Uint8Array(0),
      policy: STRICT_ED25519_POLICY,
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: false, reason: 'signature-missing' });
  });

  it('returns untrusted-publisher when keyId is not in policy.trustedPublisherKeyIds', () => {
    const { publisherKey, signatureBytes } = makeEd25519KeyAndSig();
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes,
      policy: { ...STRICT_ED25519_POLICY, trustedPublisherKeyIds: ['some-other-key'] },
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: false, reason: 'untrusted-publisher' });
  });

  it('returns algorithm-mismatch when policy and key disagree', () => {
    const { publisherKey, signatureBytes } = makeEd25519KeyAndSig();
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes,
      policy: { ...STRICT_ED25519_POLICY, signatureAlgorithm: 'rsa-pss-sha256' },
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: false, reason: 'algorithm-mismatch' });
  });

  it('returns signature-invalid when the signature bytes are mutated', () => {
    const { publisherKey, signatureBytes } = makeEd25519KeyAndSig();
    const tampered = new Uint8Array(signatureBytes);
    // Flip a bit in the middle of the signature.
    tampered[10] = tampered[10] ^ 0xff;
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes: tampered,
      policy: STRICT_ED25519_POLICY,
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: false, reason: 'signature-invalid' });
  });
});

describe('verifyBinarySignature — enforce: "off" short-circuit', () => {
  it('returns { verified: true, reason: "verified" } even with empty signature', () => {
    const { publisherKey } = makeEd25519KeyAndSig();
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes: new Uint8Array(0),
      policy: { ...STRICT_ED25519_POLICY, enforce: 'off' },
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: true, reason: 'verified' });
  });

  it('returns verified even when key is untrusted (off bypasses every gate)', () => {
    const { publisherKey, signatureBytes } = makeEd25519KeyAndSig();
    const result = verifyBinarySignature({
      binaryBytes: BINARY_BYTES,
      signatureBytes,
      policy: {
        ...STRICT_ED25519_POLICY,
        enforce: 'off',
        trustedPublisherKeyIds: ['unrelated-key'],
      },
      publisherPublicKey: publisherKey,
    });
    expect(result).toEqual({ verified: true, reason: 'verified' });
  });
});
