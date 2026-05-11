// packages/tts-kokoro/src/stub-audio.ts
// Deterministic silent-WAV generator for the stub-mode KokoroTtsProvider.
// Pure function: same (durationS, sampleRate) → byte-identical output.
// No `Date`, no `Math.random`, no `fetch`, no timers.
//
// Output is a `data:audio/wav;base64,...` URI for a mono 16-bit PCM WAV
// with every PCM sample set to zero (silent). The WAV header follows the
// standard RIFF/WAVE/fmt /data 44-byte layout. Production wire-up
// (T-426a) replaces this with a real Kokoro library call; the
// surrounding shape (URL string) stays identical.

/**
 * Generate a deterministic silent-WAV `data:` URI.
 *
 * Layout: 44-byte standard RIFF/WAVE header (mono, 16-bit PCM) followed
 * by `floor(durationS * sampleRate) * 2` zero bytes for the samples.
 *
 * Pure: same inputs → byte-identical output. Tested against the WAV
 * spec offsets (RIFF/WAVE/fmt magics, sample-rate field, data-chunk
 * size, all-zero samples).
 *
 * @param durationS Duration in seconds. Must be > 0.
 * @param sampleRate Sample rate in Hz. Must be a positive integer.
 * @returns `data:audio/wav;base64,<base64-of-WAV-bytes>` URI.
 */
export function generateSilentWavDataUri(durationS: number, sampleRate: number): string {
  if (!Number.isFinite(durationS) || durationS <= 0) {
    throw new Error(
      `generateSilentWavDataUri: durationS must be a positive finite number; received ${durationS}`,
    );
  }
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new Error(
      `generateSilentWavDataUri: sampleRate must be a positive integer; received ${sampleRate}`,
    );
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(durationS * sampleRate);
  const dataChunkSize = numSamples * numChannels * bytesPerSample;
  const fmtChunkSize = 16; // PCM
  const totalSize = 4 + (8 + fmtChunkSize) + (8 + dataChunkSize); // "WAVE" + fmt sub-chunk + data sub-chunk
  const headerSize = 44;
  const totalBytes = headerSize + dataChunkSize;

  const buf = new Uint8Array(totalBytes);
  const view = new DataView(buf.buffer);

  // RIFF header
  writeAscii(buf, 0, 'RIFF');
  view.setUint32(4, totalSize, true); // chunk size
  writeAscii(buf, 8, 'WAVE');

  // fmt sub-chunk
  writeAscii(buf, 12, 'fmt ');
  view.setUint32(16, fmtChunkSize, true); // sub-chunk size
  view.setUint16(20, 1, true); // audio format = 1 (PCM)
  view.setUint16(22, numChannels, true); // num channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bitsPerSample, true); // bits per sample

  // data sub-chunk
  writeAscii(buf, 36, 'data');
  view.setUint32(40, dataChunkSize, true); // sub-chunk size

  // PCM samples (offset 44..end) are already zero — Uint8Array initializes
  // to zero. No further work needed.

  return `data:audio/wav;base64,${bytesToBase64(buf)}`;
}

/** Write an ASCII string into `buf` starting at `offset`. */
function writeAscii(buf: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i += 1) {
    buf[offset + i] = str.charCodeAt(i) & 0xff;
  }
}

/**
 * Encode a `Uint8Array` to a base64 string. Uses `Buffer` when running on
 * Node; falls back to `btoa` otherwise. Both paths are deterministic +
 * synchronous; tests cover the Node path.
 */
function bytesToBase64(bytes: Uint8Array): string {
  // Node path — `Buffer` is the fastest option on every supported runtime.
  const globalAny = globalThis as {
    Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } };
  };
  if (typeof globalAny.Buffer !== 'undefined') {
    return globalAny.Buffer.from(bytes).toString('base64');
  }
  // Browser fallback — `btoa` requires a binary string.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}
