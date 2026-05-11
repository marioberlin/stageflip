// packages/video-seedance/src/stub-video.test.ts
// Coverage for `generateStubMp4DataUri` — ftyp magic, determinism, fixture
// invariants, input rejection. Per docs/tasks/T-430.md AC #7.

import { describe, expect, it } from 'vitest';

import { generateStubMp4DataUri } from './stub-video.js';

const FTYP_MAGIC = 0x66747970; // "ftyp"

/** Decode a `data:video/mp4;base64,...` URI back to its raw bytes. */
function decodeDataUri(uri: string): Uint8Array {
  const prefix = 'data:video/mp4;base64,';
  if (!uri.startsWith(prefix)) {
    throw new Error(`expected data URI prefix "${prefix}"; got "${uri.slice(0, 40)}..."`);
  }
  const base64 = uri.slice(prefix.length);
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

describe('generateStubMp4DataUri', () => {
  it('returns a data:video/mp4;base64, URI', () => {
    const uri = generateStubMp4DataUri('a cinematic shot of a sunrise');
    expect(uri.startsWith('data:video/mp4;base64,')).toBe(true);
  });

  it('emits the MP4 ftyp signature at offset 4', () => {
    const bytes = decodeDataUri(generateStubMp4DataUri('a video'));
    expect(readUint32BE(bytes, 4)).toBe(FTYP_MAGIC);
  });

  it('first box size at offset 0 is a positive multiple of 4', () => {
    const bytes = decodeDataUri(generateStubMp4DataUri('a video'));
    const firstBoxSize = readUint32BE(bytes, 0);
    expect(firstBoxSize).toBeGreaterThan(0);
    expect(firstBoxSize % 4).toBe(0);
  });

  it('is byte-identical for identical inputs (deterministic; cache-key roundtrip)', () => {
    const a = generateStubMp4DataUri('a video');
    const b = generateStubMp4DataUri('a video');
    expect(a).toBe(b);
  });

  it('is byte-identical regardless of prompt (prompt does not embed in the MP4)', () => {
    const a = generateStubMp4DataUri('a video');
    const b = generateStubMp4DataUri('a totally different prompt');
    expect(a).toBe(b);
  });

  it('is byte-identical regardless of seed (seed does not embed in the MP4)', () => {
    const a = generateStubMp4DataUri('a video', 1);
    const b = generateStubMp4DataUri('a video', 9999);
    expect(a).toBe(b);
  });

  it('rejects empty prompt', () => {
    expect(() => generateStubMp4DataUri('')).toThrow(/non-empty/);
  });

  it('rejects whitespace-only prompt', () => {
    expect(() => generateStubMp4DataUri('   \t\n')).toThrow(/non-empty/);
  });

  it('decoded bytes form a valid MP4 (ftyp box parses)', () => {
    const bytes = decodeDataUri(generateStubMp4DataUri('x'));
    const ftypSize = readUint32BE(bytes, 0);
    expect(bytes.length).toBeGreaterThanOrEqual(ftypSize);
    // The next box should be parseable too (moov for our fixture).
    expect(bytes.length).toBeGreaterThan(ftypSize + 8);
    const nextBoxSize = readUint32BE(bytes, ftypSize);
    expect(nextBoxSize).toBeGreaterThan(0);
  });

  it('total bytes are non-trivial (>= 100 bytes — sanity bound on the fixture)', () => {
    const bytes = decodeDataUri(generateStubMp4DataUri('x'));
    expect(bytes.length).toBeGreaterThanOrEqual(100);
  });
});
