// packages/export-html5-zip/src/fallback/encoders.test.ts
// T-204 — encodePng + encodeGif unit coverage. Exercises the byte-level
// guarantees the orchestrator relies on.

import { describe, expect, it } from 'vitest';

import { encodeGif } from './render-gif.js';
import { encodePng } from './render-png.js';
import type { RgbaFrame } from './types.js';

function solidFrame(width: number, height: number, r: number, g: number, b: number): RgbaFrame {
  const bytes = new Uint8Array(width * height * 4);
  for (let i = 0; i < bytes.length; i += 4) {
    bytes[i] = r;
    bytes[i + 1] = g;
    bytes[i + 2] = b;
    bytes[i + 3] = 255;
  }
  return { width, height, bytes };
}

describe('encodePng', () => {
  it('produces a valid PNG signature', () => {
    const bytes = encodePng(solidFrame(4, 4, 255, 0, 0));
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
    expect(bytes[4]).toBe(0x0d);
    expect(bytes[5]).toBe(0x0a);
    expect(bytes[6]).toBe(0x1a);
    expect(bytes[7]).toBe(0x0a);
  });

  it('rejects a frame with mismatched byte length', () => {
    expect(() => encodePng({ width: 4, height: 4, bytes: new Uint8Array(10) })).toThrow(
      /byte length/,
    );
  });

  it('is deterministic for identical input', () => {
    const f = solidFrame(8, 8, 100, 120, 140);
    expect(encodePng(f)).toEqual(encodePng(f));
  });
});

describe('encodeGif', () => {
  it('produces a valid GIF89a header', () => {
    const bytes = encodeGif([solidFrame(4, 4, 10, 20, 30)]);
    const sig = new TextDecoder().decode(bytes.slice(0, 6));
    expect(sig).toMatch(/^GIF8[79]a$/);
  });

  it('rejects an empty frame list', () => {
    expect(() => encodeGif([])).toThrow(/at least one frame/);
  });

  it('rejects heterogeneous frame dimensions', () => {
    expect(() => encodeGif([solidFrame(4, 4, 0, 0, 0), solidFrame(4, 8, 0, 0, 0)])).toThrow(
      /share dimensions/,
    );
  });

  it('rejects a frame with mismatched byte length', () => {
    const bad: RgbaFrame = { width: 4, height: 4, bytes: new Uint8Array(10) };
    expect(() => encodeGif([bad])).toThrow(/byte length/);
  });

  it('supports a multi-frame animation', () => {
    const frames = [
      solidFrame(4, 4, 255, 0, 0),
      solidFrame(4, 4, 0, 255, 0),
      solidFrame(4, 4, 0, 0, 255),
    ];
    const bytes = encodeGif(frames);
    expect(bytes.length).toBeGreaterThan(100);
  });

  it('is deterministic for identical input', () => {
    const frames = [solidFrame(6, 6, 60, 120, 180), solidFrame(6, 6, 70, 130, 190)];
    expect(encodeGif(frames)).toEqual(encodeGif(frames));
  });
});
