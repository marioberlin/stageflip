// packages/pack-format/src/signature.test.ts
// Unit tests for Ed25519 sign/verify (T-494 / ADR-012 §D3).

import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { ED25519_SIGNATURE_LENGTH, signPackArchive, verifyPackArchive } from './signature.js';

function makeKeyPair() {
  return generateKeyPairSync('ed25519');
}

const ARCHIVE = new TextEncoder().encode('hello stageflip pack');

describe('signPackArchive + verifyPackArchive', () => {
  it('produces a 64-byte signature', () => {
    const { privateKey } = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, privateKey);
    expect(sig.length).toBe(ED25519_SIGNATURE_LENGTH);
  });

  it('verifies a valid signature', () => {
    const { privateKey, publicKey } = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, privateKey);
    expect(verifyPackArchive(ARCHIVE, sig, publicKey)).toBe(true);
  });

  it('rejects a signature with the wrong public key', () => {
    const a = makeKeyPair();
    const b = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, a.privateKey);
    expect(verifyPackArchive(ARCHIVE, sig, b.publicKey)).toBe(false);
  });

  it('rejects a signature when the archive bytes have been tampered with', () => {
    const { privateKey, publicKey } = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, privateKey);
    const tampered = new Uint8Array(ARCHIVE);
    tampered[0] = ((tampered[0] ?? 0) ^ 1) & 0xff;
    expect(verifyPackArchive(tampered, sig, publicKey)).toBe(false);
  });

  it('rejects a corrupted signature without throwing', () => {
    const { privateKey, publicKey } = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, privateKey);
    const corrupted = new Uint8Array(sig);
    corrupted[0] = ((corrupted[0] ?? 0) ^ 1) & 0xff;
    expect(verifyPackArchive(ARCHIVE, corrupted, publicKey)).toBe(false);
  });

  it('accepts a PEM-encoded public key (string)', () => {
    const { privateKey, publicKey } = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, privateKey);
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(verifyPackArchive(ARCHIVE, sig, pem)).toBe(true);
  });

  it('accepts a Buffer public key', () => {
    const { privateKey, publicKey } = makeKeyPair();
    const sig = signPackArchive(ARCHIVE, privateKey);
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    expect(verifyPackArchive(ARCHIVE, sig, pem as Buffer)).toBe(true);
  });
});

describe('ED25519_SIGNATURE_LENGTH', () => {
  it('is 64 (Ed25519 standard)', () => {
    expect(ED25519_SIGNATURE_LENGTH).toBe(64);
  });
});
