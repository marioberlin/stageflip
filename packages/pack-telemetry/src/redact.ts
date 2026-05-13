// packages/pack-telemetry/src/redact.ts
// T-503 — Redaction helpers. The pack-telemetry pipeline never
// transmits plaintext publisher or pack names; `hashPackId` is the
// single anonymization seam.

import { createHash } from 'node:crypto';

import type { PackTelemetryPlatform } from './events.js';

/**
 * Compute a stable, anonymous identifier for a pack by hashing
 * `${publisherId}/${packId}` with SHA-256 and rendering the digest
 * as lowercase hex.
 *
 * The hash is collision-resistant for the cardinality of installed
 * packs (≤ ~1e6) and is one-way — the transport cannot recover the
 * publisher or pack names from the hash. ADR-001's opt-in posture
 * requires anonymous identifiers when telemetry is enabled.
 */
export function hashPackId(publisherId: string, packId: string): string {
  return createHash('sha256').update(`${publisherId}/${packId}`, 'utf8').digest('hex');
}

/**
 * Map `process.platform` (or a caller-provided string) to the
 * four-literal `PackTelemetryPlatform` union. Unknown values
 * (including `'aix'`, `'android'`, `'freebsd'`, `'sunos'`) collapse
 * to `'unknown'` so the event schema stays tight.
 */
export function detectPlatform(
  platform: NodeJS.Platform | string = process.platform,
): PackTelemetryPlatform {
  switch (platform) {
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'win32';
    default:
      return 'unknown';
  }
}
