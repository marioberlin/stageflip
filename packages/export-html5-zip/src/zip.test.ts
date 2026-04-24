// packages/export-html5-zip/src/zip.test.ts
// T-203a — deterministic ZIP packer tests.

import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  DETERMINISTIC_ZIP_MTIME,
  type ZipFile,
  assertValidZipPath,
  packDeterministicZip,
  stringToZipBytes,
} from './zip.js';

function textFile(path: string, text: string): ZipFile {
  return { path, bytes: stringToZipBytes(text) };
}

describe('assertValidZipPath', () => {
  it('rejects empty paths', () => {
    expect(() => assertValidZipPath('')).toThrow(/must not be empty/);
  });

  it('rejects paths starting with /', () => {
    expect(() => assertValidZipPath('/foo')).toThrow(/must not start with '\/'/);
  });

  it('rejects paths with backslashes', () => {
    expect(() => assertValidZipPath('foo\\bar')).toThrow(/backslashes/);
  });

  it('rejects paths with .. segments', () => {
    expect(() => assertValidZipPath('assets/../etc/passwd')).toThrow(/'\.\.'/);
  });

  it('accepts a normal relative path', () => {
    expect(() => assertValidZipPath('assets/foo/bar.png')).not.toThrow();
  });
});

describe('packDeterministicZip', () => {
  it('produces byte-identical output for identical inputs', () => {
    const input: ZipFile[] = [
      textFile('index.html', '<!doctype html><html></html>'),
      textFile('assets/a.css', 'body{}'),
    ];
    const a = packDeterministicZip(input);
    const b = packDeterministicZip(input);
    expect(a).toEqual(b);
  });

  it('sorts files lexicographically regardless of input order', () => {
    const shuffled: ZipFile[] = [
      textFile('z.txt', 'z'),
      textFile('a.txt', 'a'),
      textFile('m.txt', 'm'),
    ];
    const sorted: ZipFile[] = [
      textFile('a.txt', 'a'),
      textFile('m.txt', 'm'),
      textFile('z.txt', 'z'),
    ];
    expect(packDeterministicZip(shuffled)).toEqual(packDeterministicZip(sorted));
  });

  it('round-trips file contents via unzip', () => {
    const input: ZipFile[] = [
      textFile('index.html', '<!doctype html>'),
      textFile('script.js', 'window.clickTag="x";'),
    ];
    const zipped = packDeterministicZip(input);
    const out = unzipSync(zipped);
    expect(Object.keys(out).sort()).toEqual(['index.html', 'script.js']);
    expect(new TextDecoder().decode(out['index.html'])).toBe('<!doctype html>');
    expect(new TextDecoder().decode(out['script.js'])).toBe('window.clickTag="x";');
  });

  it('rejects duplicate paths', () => {
    expect(() => packDeterministicZip([textFile('a.txt', 'x'), textFile('a.txt', 'y')])).toThrow(
      /duplicate path/,
    );
  });

  it('rejects invalid paths through the ZipFile list', () => {
    expect(() => packDeterministicZip([textFile('', 'x')])).toThrow(/must not be empty/);
    expect(() => packDeterministicZip([textFile('/abs', 'x')])).toThrow(/must not start with/);
  });

  it('accepts compression levels 0 (stored) through 9', () => {
    const input = [textFile('x.txt', 'hello')];
    for (const level of [0, 6, 9] as const) {
      const out = packDeterministicZip(input, { level });
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it('returns the empty-ZIP header for an empty input list', () => {
    const out = packDeterministicZip([]);
    // End-of-central-directory-record signature is 0x06054b50 (little-endian):
    // 50 4B 05 06 must appear somewhere in the output of a valid ZIP.
    const hasEocd = out.some(
      (_, i) =>
        out[i] === 0x50 && out[i + 1] === 0x4b && out[i + 2] === 0x05 && out[i + 3] === 0x06,
    );
    expect(hasEocd).toBe(true);
  });

  it('pins DETERMINISTIC_ZIP_MTIME to 2000-01-01 UTC', () => {
    expect(DETERMINISTIC_ZIP_MTIME.toISOString()).toBe('2000-01-01T00:00:00.000Z');
  });
});

describe('stringToZipBytes', () => {
  it('encodes ASCII 1:1', () => {
    expect(stringToZipBytes('abc')).toEqual(new Uint8Array([97, 98, 99]));
  });

  it('encodes UTF-8 multi-byte chars', () => {
    // "é" → 0xC3 0xA9
    expect(stringToZipBytes('é')).toEqual(new Uint8Array([0xc3, 0xa9]));
  });
});
