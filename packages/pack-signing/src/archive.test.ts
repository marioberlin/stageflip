// packages/pack-signing/src/archive.test.ts
// T-498 — Round-trip + edge-case tests for the in-house deterministic
// archive format.

import { describe, expect, it } from 'vitest';

import {
  ARCHIVE_MAGIC,
  type ArchiveFile,
  ArchiveParseError,
  parseArchive,
  synthesizeArchive,
} from './archive.js';

function ascii(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('synthesizeArchive + parseArchive', () => {
  it('round-trips a multi-file map', () => {
    const files: ArchiveFile[] = [
      { path: 'manifest.json', content: ascii('{"manifestVersion":"1"}') },
      { path: 'a/b.txt', content: ascii('hello') },
      { path: 'a/c.txt', content: ascii('world') },
    ];
    const archive = synthesizeArchive(files);
    const parsed = parseArchive(archive);
    expect(parsed).toHaveLength(3);
    // After sort, order is: a/b.txt, a/c.txt, manifest.json.
    expect(parsed.map((f) => f.path)).toEqual(['a/b.txt', 'a/c.txt', 'manifest.json']);
    expect(new TextDecoder().decode(parsed[0]?.content)).toBe('hello');
    expect(new TextDecoder().decode(parsed[1]?.content)).toBe('world');
  });

  it('handles an empty file list (file-count = 0)', () => {
    const archive = synthesizeArchive([]);
    expect(archive.length).toBe(ARCHIVE_MAGIC.length + 4);
    expect(parseArchive(archive)).toEqual([]);
  });

  it('handles a single file', () => {
    const files: ArchiveFile[] = [{ path: 'only.txt', content: ascii('x') }];
    const archive = synthesizeArchive(files);
    const parsed = parseArchive(archive);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.path).toBe('only.txt');
    expect(new TextDecoder().decode(parsed[0]?.content)).toBe('x');
  });

  it('produces byte-stable output across shuffled input orders', () => {
    const a: ArchiveFile[] = [
      { path: 'a.txt', content: ascii('1') },
      { path: 'b.txt', content: ascii('2') },
      { path: 'c.txt', content: ascii('3') },
    ];
    const b: ArchiveFile[] = [
      { path: 'c.txt', content: ascii('3') },
      { path: 'a.txt', content: ascii('1') },
      { path: 'b.txt', content: ascii('2') },
    ];
    expect(synthesizeArchive(a)).toEqual(synthesizeArchive(b));
  });

  it('rejects an archive with bad magic', () => {
    const bad = new Uint8Array(16);
    bad.set([0x00, 0x00, 0x00, 0x00], 0);
    expect(() => parseArchive(bad)).toThrow(ArchiveParseError);
  });

  it('rejects a truncated path-length header', () => {
    // Magic + count=1, then only 1 byte of the 2-byte path-length.
    const truncated = new Uint8Array(ARCHIVE_MAGIC.length + 4 + 1);
    truncated.set(ARCHIVE_MAGIC, 0);
    const view = new DataView(truncated.buffer);
    view.setUint32(ARCHIVE_MAGIC.length, 1, false);
    expect(() => parseArchive(truncated)).toThrow(ArchiveParseError);
  });

  it('rejects a truncated content section', () => {
    // Valid header + path bytes, but content length says 100 with no bytes.
    const archive = synthesizeArchive([{ path: 'x', content: ascii('hello') }]);
    // Slice off the last byte of content.
    const truncated = archive.subarray(0, archive.length - 1);
    expect(() => parseArchive(truncated)).toThrow(ArchiveParseError);
  });

  it('rejects an archive that is shorter than the minimum header', () => {
    expect(() => parseArchive(new Uint8Array(4))).toThrow(ArchiveParseError);
  });

  it('emits files in ascending lexicographic path order', () => {
    const files: ArchiveFile[] = [
      { path: 'zebra.txt', content: ascii('z') },
      { path: 'apple.txt', content: ascii('a') },
      { path: 'mango.txt', content: ascii('m') },
    ];
    const parsed = parseArchive(synthesizeArchive(files));
    expect(parsed.map((f) => f.path)).toEqual(['apple.txt', 'mango.txt', 'zebra.txt']);
  });
});
