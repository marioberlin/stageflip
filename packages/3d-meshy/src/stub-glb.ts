// packages/3d-meshy/src/stub-glb.ts
// Deterministic placeholder GLB synthesizer for the stub-mode
// MeshyThreeDProvider. Pure function: same `prompt` → byte-identical
// output. No `Date`, no `Math.random`, no `fetch`, no timers.
//
// Output is a `data:model/gltf-binary;base64,...` URI for a minimal
// valid GLB (glTF 2.0 binary container) describing a regular
// icosahedron (12 vertices, 20 triangular faces via 60 indices). Meshy
// targets props + environment (NOT characters), so the stub:
//   - Uses an icosahedron (visually distinct from Tripo's unit cube,
//     so diff readers can tell adapter outputs apart at a glance).
//   - Ships **no** skin / joints / weights — capability declares
//     `supportsAutoRigging: false` (T-437 also refuses rigging on
//     `triangle-soup` topology per ADR-008 §D6).
// The on-the-wire bytes are byte-identical for ANY input — `prompt`
// and `seed` differentiate the cache key only.
//
// GLB layout (per https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout):
//   12-byte header: magic (0x46546C67 "glTF"), version (2), length.
//   JSON chunk:     length, chunkType (0x4E4F534A "JSON"), padded payload.
//   BIN chunk:      length, chunkType (0x004E4942 "BIN\0"), padded payload.
//
// Production wire-up (T-429a) replaces this with a real Meshy HTTPS API
// call + GLB download; the surrounding shape (URL string) stays identical.

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
const BIN_CHUNK_TYPE = 0x004e4942; // "BIN\0"

/**
 * Generate a deterministic placeholder GLB `data:` URI.
 *
 * Pure: same `prompt` → byte-identical output. Tested against the
 * GLB spec offsets (header magic, version, JSON / BIN chunk-type magics,
 * total length). The prompt parameter is validated for non-emptiness but
 * does NOT influence the GLB bytes; cache-key differentiation lives in
 * the provider's `deriveCacheKey` call. The seed parameter is accepted
 * for signature parity with the production wire-up but does not
 * influence the bytes.
 *
 * @param prompt The asset prompt. Validated non-empty after trim.
 * @param _seed Cache-key differentiator only — does NOT influence bytes.
 *              Accepted for signature parity with the production wire-up.
 * @returns `data:model/gltf-binary;base64,<base64-of-GLB-bytes>` URI.
 */
export function generateStubGlbDataUri(prompt: string, _seed?: number): string {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error(
      `generateStubGlbDataUri: prompt must be a non-empty string after trim; received ${JSON.stringify(prompt)}`,
    );
  }

  const bin = buildBin();
  const json = buildJson(bin);
  const bytes = assembleGlb(json, bin.bytes);
  return `data:model/gltf-binary;base64,${bytesToBase64(bytes)}`;
}

// ---------------------------------------------------------------------------
// Icosahedron geometry — 12 vertices, 20 faces (60 indices)
// ---------------------------------------------------------------------------

// The 12 vertices of a regular icosahedron centered at the origin.
// Coordinates use the (0, ±1, ±phi) cyclic permutation form, scaled
// by 1 / sqrt(1 + phi^2) so vertex magnitude = 1 (unit-radius
// circumscribed sphere). Constants pre-computed to avoid floating-point
// determinism risks across runtimes.
//
//   phi = (1 + sqrt(5)) / 2 ≈ 1.6180339887498949
//   inv = 1 / sqrt(1 + phi^2) ≈ 0.5257311121191336
//   t   = phi * inv         ≈ 0.85065080835204
const ICO_T = 0.85065080835204; // phi / sqrt(1 + phi^2)
const ICO_S = 0.5257311121191336; // 1 / sqrt(1 + phi^2)

/** 12 vertices * vec3 * 4 bytes = 144 bytes. */
const ICO_POSITIONS: ReadonlyArray<number> = [
  // (0, ±s, ±t)
  0,
  -ICO_S,
  ICO_T,
  0,
  ICO_S,
  ICO_T,
  0,
  -ICO_S,
  -ICO_T,
  0,
  ICO_S,
  -ICO_T,
  // (±s, ±t, 0)
  -ICO_S,
  ICO_T,
  0,
  ICO_S,
  ICO_T,
  0,
  -ICO_S,
  -ICO_T,
  0,
  ICO_S,
  -ICO_T,
  0,
  // (±t, 0, ±s)
  ICO_T,
  0,
  -ICO_S,
  ICO_T,
  0,
  ICO_S,
  -ICO_T,
  0,
  -ICO_S,
  -ICO_T,
  0,
  ICO_S,
];

/**
 * 20 triangular faces → 60 indices, ushort (2 bytes each = 120 bytes).
 * Vertex numbering matches `ICO_POSITIONS` above. Faces are in
 * counter-clockwise winding order viewed from outside the polyhedron.
 */
const ICO_INDICES: ReadonlyArray<number> = [
  // 5 faces around vertex 0
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
  // 5 adjacent faces
  1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  // 5 faces around vertex 3
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
  // 5 adjacent faces
  4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

interface BinPayload {
  /** Concatenated binary chunk payload (4-byte aligned). */
  readonly bytes: Uint8Array;
  /** Byte offset of the position buffer inside `bytes`. */
  readonly positionsOffset: number;
  /** Byte length of the position buffer (12 vertices * vec3 * 4 bytes = 144). */
  readonly positionsLength: number;
  /** Byte offset of the index buffer inside `bytes`. */
  readonly indicesOffset: number;
  /** Byte length of the index buffer (60 indices * uint16 * 2 bytes = 120). */
  readonly indicesLength: number;
}

function buildBin(): BinPayload {
  const positionsLength = ICO_POSITIONS.length * 4;
  const indicesLength = ICO_INDICES.length * 2;
  const totalUnpadded = positionsLength + indicesLength;
  const total = padTo4(totalUnpadded);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  let offset = 0;
  for (const v of ICO_POSITIONS) {
    view.setFloat32(offset, v, true);
    offset += 4;
  }
  const positionsOffset = 0;
  const indicesOffset = positionsLength;
  for (const i of ICO_INDICES) {
    view.setUint16(offset, i, true);
    offset += 2;
  }
  // Padding bytes are already zero (Uint8Array default-initialized).
  return { bytes, positionsOffset, positionsLength, indicesOffset, indicesLength };
}

// ---------------------------------------------------------------------------
// JSON chunk — Meshy props/environment never rig (no skin / joints / weights)
// ---------------------------------------------------------------------------

/** Build the icosahedron glTF JSON. POSITION attribute only — no rig. */
function buildJson(bin: BinPayload): string {
  const doc = {
    asset: { version: '2.0', generator: 'stageflip-3d-meshy-stub' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'icosahedron' }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
          },
        ],
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: bin.positionsOffset,
        byteLength: bin.positionsLength,
        target: 34962, // ARRAY_BUFFER
      },
      {
        buffer: 0,
        byteOffset: bin.indicesOffset,
        byteLength: bin.indicesLength,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: 12,
        type: 'VEC3',
        min: [-ICO_T, -ICO_T, -ICO_T],
        max: [ICO_T, ICO_T, ICO_T],
      },
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: 60,
        type: 'SCALAR',
      },
    ],
    buffers: [{ byteLength: bin.bytes.byteLength }],
  };
  return JSON.stringify(doc);
}

// ---------------------------------------------------------------------------
// Container assembly
// ---------------------------------------------------------------------------

/** Pad `n` up to the next multiple of 4. */
function padTo4(n: number): number {
  return (n + 3) & ~3;
}

/**
 * Assemble the full GLB byte buffer: 12-byte header + JSON chunk + BIN
 * chunk. JSON payload is space-padded (`0x20`) to a 4-byte boundary; BIN
 * payload is zero-padded (`0x00`).
 */
function assembleGlb(jsonText: string, binBytes: Uint8Array): Uint8Array {
  const jsonBytesUnpadded = new TextEncoder().encode(jsonText);
  const jsonPadded = padTo4(jsonBytesUnpadded.length);
  const binPadded = padTo4(binBytes.length);
  const total = 12 + 8 + jsonPadded + 8 + binPadded;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  // Header.
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);

  // JSON chunk header.
  view.setUint32(12, jsonPadded, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);

  // JSON payload + space-padding.
  out.set(jsonBytesUnpadded, 20);
  for (let i = jsonBytesUnpadded.length; i < jsonPadded; i += 1) {
    out[20 + i] = 0x20; // space
  }

  // BIN chunk header.
  const binChunkLengthOffset = 20 + jsonPadded;
  view.setUint32(binChunkLengthOffset, binPadded, true);
  view.setUint32(binChunkLengthOffset + 4, BIN_CHUNK_TYPE, true);

  // BIN payload + zero-padding (zero-padding is implicit; Uint8Array
  // default-initializes to zero).
  out.set(binBytes, binChunkLengthOffset + 8);

  return out;
}

/**
 * Encode a `Uint8Array` to a base64 string. Uses `Buffer` when running on
 * Node; falls back to `btoa` otherwise. Both paths are deterministic +
 * synchronous; tests cover the Node path.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const globalAny = globalThis as {
    Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } };
  };
  if (typeof globalAny.Buffer !== 'undefined') {
    return globalAny.Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}
