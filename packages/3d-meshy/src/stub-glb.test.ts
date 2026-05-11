// packages/3d-meshy/src/stub-glb.test.ts
// Coverage for `generateStubGlbDataUri` — header magic, version, chunk-type
// magics, determinism, no-rig invariant, input rejection, and a
// byte-distinctness sanity check vs Tripo's unrigged stub. Per
// docs/tasks/T-429.md AC #7.

import { describe, expect, it } from 'vitest';

// Cross-package import for the "visually distinct" sanity check —
// Meshy's stub MUST byte-differ from Tripo's unrigged cube stub so diff
// readers can tell adapter outputs apart.
import { generateStubGlbDataUri as generateTripoStub } from '../../3d-tripo/src/stub-glb.js';
import { generateStubGlbDataUri as generateMeshyStub } from './stub-glb.js';

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
    const uri = generateMeshyStub('a prop');
    expect(uri.startsWith('data:model/gltf-binary;base64,')).toBe(true);
  });

  it('emits the GLB magic (glTF) at offset 0', () => {
    const bytes = decodeDataUri(generateMeshyStub('a prop'));
    expect(readUint32LE(bytes, 0)).toBe(GLB_MAGIC);
  });

  it('emits version = 2 at offset 4', () => {
    const bytes = decodeDataUri(generateMeshyStub('a prop'));
    expect(readUint32LE(bytes, 4)).toBe(2);
  });

  it('total length at offset 8 matches the actual byte length', () => {
    const bytes = decodeDataUri(generateMeshyStub('a prop'));
    expect(readUint32LE(bytes, 8)).toBe(bytes.length);
  });

  it('first chunk is the JSON chunk (type magic 0x4E4F534A)', () => {
    const bytes = decodeDataUri(generateMeshyStub('a prop'));
    const jsonChunkType = readUint32LE(bytes, 16);
    expect(jsonChunkType).toBe(JSON_CHUNK_TYPE);
  });

  it('second chunk is the BIN chunk (type magic 0x004E4942)', () => {
    const bytes = decodeDataUri(generateMeshyStub('a prop'));
    const jsonChunkLength = readUint32LE(bytes, 12);
    const binChunkTypeOffset = 12 + 8 + jsonChunkLength + 4;
    const binChunkType = readUint32LE(bytes, binChunkTypeOffset);
    expect(binChunkType).toBe(BIN_CHUNK_TYPE);
  });

  it('is byte-identical for identical inputs (deterministic; cache-key roundtrip)', () => {
    const a = generateMeshyStub('a prop');
    const b = generateMeshyStub('a prop');
    expect(a).toBe(b);
  });

  it('is byte-identical regardless of prompt (prompt does not embed in the GLB)', () => {
    const a = generateMeshyStub('a prop');
    const b = generateMeshyStub('a totally different environment prompt');
    expect(a).toBe(b);
  });

  it('is byte-identical regardless of seed (seed does not embed in the GLB)', () => {
    const a = generateMeshyStub('a prop', 1);
    const b = generateMeshyStub('a prop', 9999);
    expect(a).toBe(b);
  });

  it('rejects empty prompt', () => {
    expect(() => generateMeshyStub('')).toThrow(/non-empty/);
  });

  it('rejects whitespace-only prompt', () => {
    expect(() => generateMeshyStub('   \t\n')).toThrow(/non-empty/);
  });

  it('JSON chunk parses as valid JSON', () => {
    const bytes = decodeDataUri(generateMeshyStub('x'));
    const jsonChunkLength = readUint32LE(bytes, 12);
    const jsonStart = 12 + 8;
    const jsonBytes = bytes.slice(jsonStart, jsonStart + jsonChunkLength);
    const jsonText = new TextDecoder().decode(jsonBytes);
    expect(() => JSON.parse(jsonText)).not.toThrow();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    expect(parsed.asset).toBeDefined();
    expect(parsed.meshes).toBeDefined();
  });

  it('contains exactly 1 mesh with 1 primitive whose attributes = {POSITION} only (no rig)', () => {
    const bytes = decodeDataUri(generateMeshyStub('x'));
    const jsonChunkLength = readUint32LE(bytes, 12);
    const jsonStart = 12 + 8;
    const jsonBytes = bytes.slice(jsonStart, jsonStart + jsonChunkLength);
    const jsonText = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(jsonText) as {
      readonly meshes: ReadonlyArray<{
        readonly primitives: ReadonlyArray<{ readonly attributes: Record<string, unknown> }>;
      }>;
      readonly skins?: unknown;
    };
    expect(parsed.meshes).toHaveLength(1);
    expect(parsed.meshes[0]?.primitives).toHaveLength(1);
    const attrKeys = Object.keys(parsed.meshes[0]?.primitives[0]?.attributes ?? {}).sort();
    expect(attrKeys).toEqual(['POSITION']);
    // No skins/joints/weights — Meshy props/environment do not rig.
    expect(parsed.skins).toBeUndefined();
  });

  it('declares an icosahedron-shaped mesh (12 vertices, 60 indices)', () => {
    const bytes = decodeDataUri(generateMeshyStub('x'));
    const jsonChunkLength = readUint32LE(bytes, 12);
    const jsonStart = 12 + 8;
    const jsonBytes = bytes.slice(jsonStart, jsonStart + jsonChunkLength);
    const jsonText = new TextDecoder().decode(jsonBytes);
    const parsed = JSON.parse(jsonText) as {
      readonly accessors: ReadonlyArray<{ readonly count: number; readonly type: string }>;
    };
    // Accessor 0 = positions (VEC3, count = 12 vertices).
    expect(parsed.accessors[0]?.type).toBe('VEC3');
    expect(parsed.accessors[0]?.count).toBe(12);
    // Accessor 1 = indices (SCALAR, count = 20 triangles * 3 = 60).
    expect(parsed.accessors[1]?.type).toBe('SCALAR');
    expect(parsed.accessors[1]?.count).toBe(60);
  });

  it('byte-distinct from Tripo unrigged stub (each adapter ships its own placeholder shape)', () => {
    const meshy = generateMeshyStub('a prop');
    const tripo = generateTripoStub('a prop', false);
    expect(meshy).not.toBe(tripo);
  });
});
