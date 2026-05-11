// packages/3d-tripo/src/stub-glb.ts
// Deterministic placeholder GLB synthesizer for the stub-mode
// TripoThreeDProvider. Pure function: same (prompt, rig) → byte-identical
// output. No `Date`, no `Math.random`, no `fetch`, no timers.
//
// Output is a `data:model/gltf-binary;base64,...` URI for a minimal valid
// GLB (glTF 2.0 binary container) describing a unit cube (8 vertices, 12
// triangles via 36 indices) and, when `rig === true`, a single named bone
// `'root'` with an identity inverse-bind matrix and uniform skinning
// weights. The on-the-wire bytes vary ONLY with the `rig` flag — `prompt`
// and `seed` differentiate the cache key only (verified by the
// "byte-identical regardless of prompt" test).
//
// GLB layout (per https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout):
//   12-byte header: magic (0x46546C67 "glTF"), version (2), length.
//   JSON chunk:     length, chunkType (0x4E4F534A "JSON"), padded payload.
//   BIN chunk:      length, chunkType (0x004E4942 "BIN\0"), padded payload.
//
// Production wire-up (T-428a) replaces this with a real Tripo HTTPS API
// call + GLB download; the surrounding shape (URL string) stays identical.

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
const BIN_CHUNK_TYPE = 0x004e4942; // "BIN\0"

/**
 * Generate a deterministic placeholder GLB `data:` URI.
 *
 * Pure: same `(prompt, rig)` → byte-identical output. Tested against the
 * GLB spec offsets (header magic, version, JSON / BIN chunk-type magics,
 * total length). The prompt parameter is validated for non-emptiness but
 * does NOT influence the GLB bytes; cache-key differentiation lives in
 * the provider's `deriveCacheKey` call.
 *
 * @param prompt The character prompt. Validated non-empty after trim.
 * @param rig When true, the GLB embeds a single-bone skin (`'root'`) with
 *            uniform skinning weights — animator-eligible. When false,
 *            the GLB is a plain unrigged unit cube.
 * @param _seed Cache-key differentiator only — does NOT influence bytes.
 *              Accepted for signature parity with the production wire-up.
 * @returns `data:model/gltf-binary;base64,<base64-of-GLB-bytes>` URI.
 */
export function generateStubGlbDataUri(prompt: string, rig: boolean, _seed?: number): string {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error(
      `generateStubGlbDataUri: prompt must be a non-empty string after trim; received ${JSON.stringify(prompt)}`,
    );
  }

  const bin = rig ? buildRiggedBin() : buildUnriggedBin();
  const json = rig ? buildRiggedJson(bin) : buildUnriggedJson(bin);
  const bytes = assembleGlb(json, bin.bytes);
  return `data:model/gltf-binary;base64,${bytesToBase64(bytes)}`;
}

// ---------------------------------------------------------------------------
// Cube geometry — shared between unrigged and rigged variants
// ---------------------------------------------------------------------------

/** Unit cube positions: 8 vertices, 12 floats * 8 = 96 bytes. */
const CUBE_POSITIONS: ReadonlyArray<number> = [
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
  0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
];

/** 12 triangles → 36 indices, ushort (2 bytes each = 72 bytes). */
const CUBE_INDICES: ReadonlyArray<number> = [
  // -Z face
  0, 2, 1, 1, 2, 3,
  // +Z face
  4, 5, 6, 6, 5, 7,
  // -Y face
  0, 1, 4, 4, 1, 5,
  // +Y face
  2, 6, 3, 3, 6, 7,
  // -X face
  0, 4, 2, 2, 4, 6,
  // +X face
  1, 3, 5, 5, 3, 7,
];

interface BinPayload {
  /** Concatenated binary chunk payload (4-byte aligned). */
  readonly bytes: Uint8Array;
  /** Byte offset of the position buffer inside `bytes`. */
  readonly positionsOffset: number;
  /** Byte length of the position buffer (8 vertices * vec3 * 4 bytes = 96). */
  readonly positionsLength: number;
  /** Byte offset of the index buffer inside `bytes`. */
  readonly indicesOffset: number;
  /** Byte length of the index buffer (36 indices * uint16 * 2 bytes = 72). */
  readonly indicesLength: number;
  /**
   * Byte offset of the inverse-bind-matrix buffer (rigged variant only).
   * `undefined` when `rig === false`.
   */
  readonly ibmOffset?: number;
  /** Byte length of the inverse-bind-matrix buffer (1 mat4 * 16 floats * 4 bytes = 64). */
  readonly ibmLength?: number;
  /** Byte offset of the joints buffer (rigged variant only). */
  readonly jointsOffset?: number;
  /** Byte length of the joints buffer (8 vertices * vec4 * uint8 = 32). */
  readonly jointsLength?: number;
  /** Byte offset of the weights buffer (rigged variant only). */
  readonly weightsOffset?: number;
  /** Byte length of the weights buffer (8 vertices * vec4 * float32 = 128). */
  readonly weightsLength?: number;
}

function buildUnriggedBin(): BinPayload {
  // positions (96) + indices (72) — pad to 4 bytes.
  const positionsLength = CUBE_POSITIONS.length * 4;
  const indicesLength = CUBE_INDICES.length * 2;
  const totalUnpadded = positionsLength + indicesLength;
  const total = padTo4(totalUnpadded);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  let offset = 0;
  for (const v of CUBE_POSITIONS) {
    view.setFloat32(offset, v, true);
    offset += 4;
  }
  const positionsOffset = 0;
  const indicesOffset = positionsLength;
  for (const i of CUBE_INDICES) {
    view.setUint16(offset, i, true);
    offset += 2;
  }
  // Padding bytes are already zero (Uint8Array default-initialized).
  return { bytes, positionsOffset, positionsLength, indicesOffset, indicesLength };
}

function buildRiggedBin(): BinPayload {
  const positionsLength = CUBE_POSITIONS.length * 4;
  const indicesLength = CUBE_INDICES.length * 2;
  const ibmLength = 16 * 4; // 1 mat4 * 16 floats * 4 bytes
  const jointsLength = 8 * 4; // 8 vertices * vec4 * uint8
  const weightsLength = 8 * 4 * 4; // 8 vertices * vec4 * float32

  // Lay out in the order: positions, indices, IBM, joints, weights.
  // Pad each section to 4-byte boundaries (positions/indices/ibm/weights are
  // already aligned; joints — 32 bytes — is also aligned).
  const positionsOffset = 0;
  const indicesOffset = positionsOffset + positionsLength;
  const ibmOffset = padTo4(indicesOffset + indicesLength);
  const jointsOffset = ibmOffset + ibmLength;
  const weightsOffset = jointsOffset + jointsLength;
  const totalUnpadded = weightsOffset + weightsLength;
  const total = padTo4(totalUnpadded);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);

  // Positions.
  let offset = positionsOffset;
  for (const v of CUBE_POSITIONS) {
    view.setFloat32(offset, v, true);
    offset += 4;
  }

  // Indices.
  offset = indicesOffset;
  for (const i of CUBE_INDICES) {
    view.setUint16(offset, i, true);
    offset += 2;
  }

  // IBM — identity 4x4 (column-major per glTF spec).
  offset = ibmOffset;
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      view.setFloat32(offset, row === col ? 1 : 0, true);
      offset += 4;
    }
  }

  // Joints — every vertex bound to joint 0 (the only joint), rest 0.
  offset = jointsOffset;
  for (let v = 0; v < 8; v += 1) {
    bytes[offset] = 0;
    bytes[offset + 1] = 0;
    bytes[offset + 2] = 0;
    bytes[offset + 3] = 0;
    offset += 4;
  }

  // Weights — every vertex fully weighted to joint 0 (1.0, 0, 0, 0).
  offset = weightsOffset;
  for (let v = 0; v < 8; v += 1) {
    view.setFloat32(offset, 1, true);
    view.setFloat32(offset + 4, 0, true);
    view.setFloat32(offset + 8, 0, true);
    view.setFloat32(offset + 12, 0, true);
    offset += 16;
  }

  return {
    bytes,
    positionsOffset,
    positionsLength,
    indicesOffset,
    indicesLength,
    ibmOffset,
    ibmLength,
    jointsOffset,
    jointsLength,
    weightsOffset,
    weightsLength,
  };
}

// ---------------------------------------------------------------------------
// JSON chunk
// ---------------------------------------------------------------------------

/** Build the unrigged-variant glTF JSON. */
function buildUnriggedJson(bin: BinPayload): string {
  const doc = {
    asset: { version: '2.0', generator: 'stageflip-3d-tripo-stub' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'cube' }],
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
        count: 8,
        type: 'VEC3',
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: 36,
        type: 'SCALAR',
      },
    ],
    buffers: [{ byteLength: bin.bytes.byteLength }],
  };
  return JSON.stringify(doc);
}

/** Build the rigged-variant glTF JSON (adds skin + joints + weights). */
function buildRiggedJson(bin: BinPayload): string {
  const doc = {
    asset: { version: '2.0', generator: 'stageflip-3d-tripo-stub' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      // node 0 — the mesh node, bound to skin 0
      { mesh: 0, skin: 0, name: 'cube' },
      // node 1 — the bone, named 'root'
      { name: 'root' },
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, JOINTS_0: 2, WEIGHTS_0: 3 },
            indices: 1,
          },
        ],
      },
    ],
    skins: [
      {
        inverseBindMatrices: 4,
        joints: [1],
        skeleton: 1,
        name: 'root-skeleton',
      },
    ],
    bufferViews: [
      // 0 — positions
      {
        buffer: 0,
        byteOffset: bin.positionsOffset,
        byteLength: bin.positionsLength,
        target: 34962, // ARRAY_BUFFER
      },
      // 1 — indices
      {
        buffer: 0,
        byteOffset: bin.indicesOffset,
        byteLength: bin.indicesLength,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      },
      // 2 — IBMs
      {
        buffer: 0,
        byteOffset: bin.ibmOffset ?? 0,
        byteLength: bin.ibmLength ?? 0,
      },
      // 3 — joints
      {
        buffer: 0,
        byteOffset: bin.jointsOffset ?? 0,
        byteLength: bin.jointsLength ?? 0,
        target: 34962, // ARRAY_BUFFER
      },
      // 4 — weights
      {
        buffer: 0,
        byteOffset: bin.weightsOffset ?? 0,
        byteLength: bin.weightsLength ?? 0,
        target: 34962, // ARRAY_BUFFER
      },
    ],
    accessors: [
      // 0 — positions
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: 8,
        type: 'VEC3',
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      // 1 — indices
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: 36,
        type: 'SCALAR',
      },
      // 2 — joints (vec4 uint8)
      {
        bufferView: 3,
        componentType: 5121, // UNSIGNED_BYTE
        count: 8,
        type: 'VEC4',
      },
      // 3 — weights (vec4 float32)
      {
        bufferView: 4,
        componentType: 5126, // FLOAT
        count: 8,
        type: 'VEC4',
      },
      // 4 — IBMs (mat4 float32)
      {
        bufferView: 2,
        componentType: 5126, // FLOAT
        count: 1,
        type: 'MAT4',
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
