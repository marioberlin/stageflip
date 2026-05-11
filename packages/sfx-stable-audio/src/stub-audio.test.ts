// packages/sfx-stable-audio/src/stub-audio.test.ts
// Coverage for `generateSilentWavDataUri` — header magic bytes, sample-
// rate field, data-chunk size, all-zero samples, determinism. Per
// docs/tasks/T-434.md AC #5.

import { describe, expect, it } from 'vitest';

import { generateSilentWavDataUri } from './stub-audio.js';

/** Decode a `data:audio/wav;base64,...` URI back to its raw bytes. */
function decodeDataUri(uri: string): Uint8Array {
  const prefix = 'data:audio/wav;base64,';
  if (!uri.startsWith(prefix)) {
    throw new Error(`expected data URI prefix "${prefix}"; got "${uri.slice(0, 30)}..."`);
  }
  const base64 = uri.slice(prefix.length);
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(bytes[offset + i] as number);
  }
  return out;
}

describe('generateSilentWavDataUri', () => {
  it('returns a data:audio/wav;base64, URI', () => {
    const uri = generateSilentWavDataUri(1, 44100);
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('emits the RIFF/WAVE/fmt magics in the header', () => {
    const bytes = decodeDataUri(generateSilentWavDataUri(1, 44100));
    expect(readAscii(bytes, 0, 4)).toBe('RIFF');
    expect(readAscii(bytes, 8, 4)).toBe('WAVE');
    expect(readAscii(bytes, 12, 4)).toBe('fmt ');
    expect(readAscii(bytes, 36, 4)).toBe('data');
  });

  it('writes the sample-rate field at offset 24..27', () => {
    for (const sampleRate of [8000, 16000, 22050, 24000, 44100, 48000]) {
      const bytes = decodeDataUri(generateSilentWavDataUri(0.5, sampleRate));
      expect(readUint32LE(bytes, 24)).toBe(sampleRate);
    }
  });

  it('writes the data-chunk size = floor(durationS * sampleRate) * 2 (16-bit mono)', () => {
    const bytes = decodeDataUri(generateSilentWavDataUri(1.5, 44100));
    const expectedBytes = Math.floor(1.5 * 44100) * 2;
    expect(readUint32LE(bytes, 40)).toBe(expectedBytes);
  });

  it('emits zero PCM samples (all silent)', () => {
    const bytes = decodeDataUri(generateSilentWavDataUri(0.25, 44100));
    for (let i = 44; i < bytes.length; i += 1) {
      expect(bytes[i]).toBe(0);
    }
  });

  it('is byte-identical for identical inputs (deterministic)', () => {
    const a = generateSilentWavDataUri(1, 44100);
    const b = generateSilentWavDataUri(1, 44100);
    expect(a).toBe(b);
  });

  it('produces different bytes for different durations', () => {
    const a = generateSilentWavDataUri(1, 44100);
    const b = generateSilentWavDataUri(2, 44100);
    expect(a).not.toBe(b);
  });

  it('produces different bytes for different sample rates', () => {
    const a = generateSilentWavDataUri(1, 24000);
    const b = generateSilentWavDataUri(1, 44100);
    expect(a).not.toBe(b);
  });

  it('rejects non-positive durationS', () => {
    expect(() => generateSilentWavDataUri(0, 44100)).toThrow(/positive finite/);
    expect(() => generateSilentWavDataUri(-1, 44100)).toThrow(/positive finite/);
    expect(() => generateSilentWavDataUri(Number.NaN, 44100)).toThrow(/positive finite/);
    expect(() => generateSilentWavDataUri(Number.POSITIVE_INFINITY, 44100)).toThrow(
      /positive finite/,
    );
  });

  it('rejects non-integer / non-positive sampleRate', () => {
    expect(() => generateSilentWavDataUri(1, 0)).toThrow(/positive integer/);
    expect(() => generateSilentWavDataUri(1, -1)).toThrow(/positive integer/);
    expect(() => generateSilentWavDataUri(1, 1.5)).toThrow(/positive integer/);
  });

  it('writes a 44-byte header followed by data-chunk-size sample bytes', () => {
    const bytes = decodeDataUri(generateSilentWavDataUri(0.5, 44100));
    const dataChunkSize = readUint32LE(bytes, 40);
    expect(bytes.length).toBe(44 + dataChunkSize);
  });
});
