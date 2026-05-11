// packages/3d-tripo/src/stub-glb.test.ts
// Coverage for `generateStubGlbDataUri` — header magic, version, chunk-type
// magics, determinism, rig-variant size delta, input rejection. Per
// docs/tasks/T-428.md AC #7.

import { describe, expect, it } from 'vitest';

import { generateStubGlbDataUri } from './stub-glb.js';

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
const BIN_CHUNK_TYPE = 0x004e4942; // "BIN\0"

/** Decode a `data:model/gltf-binary;base64,...` URI back to its raw bytes. */
function decodeDataUri(uri: string): Uint8Array {
  const prefix = 'data:model/gltf-binary;base64,';
  if (!uri.startsWith(prefix)) {
    throw new Error(`expected data URI prefix "${prefix}"; got "${uri.slice(0, 40)}..."`);
  }
  const base64 = uri.slice(prefix.length);
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

describe('generateStubGlbDataUri', () => {
  it('returns a data:model/gltf-binary;base64, URI', () => {
    const uri = generateStubGlbDataUri('a character', false);
    expect(uri.startsWith('data:model/gltf-binary;base64,')).toBe(true);
  });

  it('emits the GLB magic (glTF) at offset 0', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('a character', false));
    expect(readUint32LE(bytes, 0)).toBe(GLB_MAGIC);
  });

  it('emits version = 2 at offset 4', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('a character', false));
    expect(readUint32LE(bytes, 4)).toBe(2);
  });

  it('total length at offset 8 matches the actual byte length', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('a character', false));
    expect(readUint32LE(bytes, 8)).toBe(bytes.length);
  });

  it('first chunk is the JSON chunk (type magic 0x4E4F534A)', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('a character', false));
    // header: 12 bytes; chunk header: 4-byte length + 4-byte type.
    const jsonChunkType = readUint32LE(bytes, 16);
    expect(jsonChunkType).toBe(JSON_CHUNK_TYPE);
  });

  it('second chunk is the BIN chunk (type magic 0x004E4942)', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('a character', false));
    const jsonChunkLength = readUint32LE(bytes, 12);
    // BIN chunk starts after: header (12) + JSON chunk header (8) + JSON
    // chunk payload (`jsonChunkLength`).
    const binChunkTypeOffset = 12 + 8 + jsonChunkLength + 4;
    const binChunkType = readUint32LE(bytes, binChunkTypeOffset);
    expect(binChunkType).toBe(BIN_CHUNK_TYPE);
  });

  it('is byte-identical for identical inputs (deterministic; cache-key roundtrip)', () => {
    const a = generateStubGlbDataUri('a character', false);
    const b = generateStubGlbDataUri('a character', false);
    expect(a).toBe(b);
  });

  it('is byte-identical regardless of prompt (prompt does not embed in the GLB)', () => {
    // The stub GLB shape varies only with the `rig` flag — prompt + seed
    // differentiate the cache key only.
    const a = generateStubGlbDataUri('a character', false);
    const b = generateStubGlbDataUri('a totally different character prompt', false);
    expect(a).toBe(b);
  });

  it('the rig=true variant has more bytes than rig=false (skin + joints data added)', () => {
    const unrigged = decodeDataUri(generateStubGlbDataUri('x', false));
    const rigged = decodeDataUri(generateStubGlbDataUri('x', true));
    expect(rigged.length).toBeGreaterThan(unrigged.length);
  });

  it('the rig=true variant is itself deterministic', () => {
    const a = generateStubGlbDataUri('x', true);
    const b = generateStubGlbDataUri('x', true);
    expect(a).toBe(b);
  });

  it('rejects empty prompt', () => {
    expect(() => generateStubGlbDataUri('', false)).toThrow(/non-empty/);
  });

  it('rejects whitespace-only prompt', () => {
    expect(() => generateStubGlbDataUri('   \t\n', false)).toThrow(/non-empty/);
  });

  it('JSON chunk parses as valid JSON', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('x', false));
    const jsonChunkLength = readUint32LE(bytes, 12);
    const jsonStart = 12 + 8;
    const jsonBytes = bytes.slice(jsonStart, jsonStart + jsonChunkLength);
    const jsonText = new TextDecoder().decode(jsonBytes);
    expect(() => JSON.parse(jsonText)).not.toThrow();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    expect(parsed.asset).toBeDefined();
    expect(parsed.meshes).toBeDefined();
  });

  it('rigged variant JSON includes a "skins" entry naming "root"', () => {
    const bytes = decodeDataUri(generateStubGlbDataUri('x', true));
    const jsonChunkLength = readUint32LE(bytes, 12);
    const jsonStart = 12 + 8;
    const jsonBytes = bytes.slice(jsonStart, jsonStart + jsonChunkLength);
    const jsonText = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(jsonText) as {
      readonly skins?: ReadonlyArray<unknown>;
      readonly nodes?: ReadonlyArray<{ readonly name?: string }>;
    };
    expect(parsed.skins).toBeDefined();
    expect(parsed.skins?.length).toBeGreaterThan(0);
    const nodeNames = (parsed.nodes ?? []).map((n) => n.name);
    expect(nodeNames).toContain('root');
  });
});
