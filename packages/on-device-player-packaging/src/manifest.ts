// packages/on-device-player-packaging/src/manifest.ts
// On-device player binary manifest schema + read/write helpers (T-400).
// The binary reads this manifest at boot to discover its tenant id,
// enabled packs + clip families, update channel, code-signing policy,
// and health-probe cadence. Strict Zod schema — typos fail loud.
//
// Determinism perimeter: this package lives OUTSIDE per CLAUDE.md §3
// (binary packaging is host-side / device-boot-time, not a clip).

import { randomBytes } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';

import { z } from 'zod';

import { codeSigningPolicySchema } from './code-signing.js';
import { updateChannelDescriptorSchema } from './update-channel.js';

/** Recognised frontier clip families, mirroring `InteractiveClipFamily`. */
export const ENABLED_CLIP_FAMILIES = [
  'shader',
  'three-scene',
  'voice',
  'ai-chat',
  'live-data',
  'web-embed',
  'ai-generative',
] as const;

/**
 * Strict schema for the on-disk manifest read by the on-device player
 * binary at boot. Versioned via `manifestVersion: 1`; future revisions
 * bump the literal + add a migration path.
 *
 * `binaryVersion` is the running player version (matches the artifact
 * shipped via the update channel). `tenantId` + `deviceId` are required
 * trust anchors for telemetry attribution. `enabledPackIds` + `enabled
 * ClipFamilies` are the binary's per-device feature gates — the binary
 * MUST refuse a clip whose family is not enabled here (this is in
 * addition to the runtime shim's per-family capability gate).
 */
export const onDeviceBinaryManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    binaryVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/),
    tenantId: z.string().min(1),
    deviceId: z.string().min(1),
    enabledPackIds: z.array(z.string()).min(0),
    enabledClipFamilies: z.array(z.enum(ENABLED_CLIP_FAMILIES)).min(0),
    updateChannel: updateChannelDescriptorSchema,
    codeSigningPolicy: codeSigningPolicySchema,
    health: z.object({ probeIntervalSec: z.number().int().min(15).max(3600) }).strict(),
  })
  .strict();

export type OnDeviceBinaryManifest = z.infer<typeof onDeviceBinaryManifestSchema>;

/** Thrown by `readManifest` when bytes fail to parse or fail Zod validation. */
export class OnDeviceBinaryManifestParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnDeviceBinaryManifestParseError';
  }
}

/**
 * Read + parse the manifest at the given path. Throws
 * `OnDeviceBinaryManifestParseError` on invalid JSON or schema failure.
 */
export function readManifest(path: string): OnDeviceBinaryManifest {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new OnDeviceBinaryManifestParseError(
      `manifest unreadable at ${path}: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new OnDeviceBinaryManifestParseError(
      `manifest is not valid JSON at ${path}: ${(err as Error).message}`,
    );
  }
  const result = onDeviceBinaryManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new OnDeviceBinaryManifestParseError(result.error.message);
  }
  return result.data;
}

/**
 * Atomic-ish manifest write: write to a sibling temp file, fsync, rename
 * over the destination. On rename failure the temp file is unlinked and
 * the original is left intact. Mirrors `writeFileAtomic` in
 * `scripts/generate-preset-from-compass.ts`.
 *
 * Temp suffix uses `process.pid` + a 4-byte cryptographically random
 * tag rather than `Date.now()` so the source-level determinism scan
 * (forbidden APIs: `Date.now`, `Math.random`, etc.) stays clean even
 * though this package is outside the CLAUDE.md §3 perimeter.
 */
export function writeManifest(path: string, manifest: OnDeviceBinaryManifest): void {
  // Validate before writing so a malformed manifest cannot reach disk.
  const validated = onDeviceBinaryManifestSchema.parse(manifest);
  const contents = `${JSON.stringify(validated, null, 2)}\n`;
  const tag = randomBytes(4).toString('hex');
  const tempPath = `${path}.tmp.${process.pid}.${tag}`;
  let fd: number | undefined;
  try {
    fd = openSync(tempPath, 'w');
    writeSync(fd, contents);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tempPath, path);
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
    }
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore — temp file may not exist
    }
    throw err;
  }
}
