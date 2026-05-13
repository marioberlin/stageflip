// packages/pack-telemetry/src/events.ts
// T-503 — Pack-telemetry event-kind discriminated union plus factory
// helpers. Three kinds (install / activation / usage) per the spec.
// All identifying fields are required to be hashed already (callers
// hash via `hashPackId` in `redact.ts`); this module never sees plain
// publisher / pack names.
//
// Determinism perimeter: `@stageflip/pack-telemetry` lives OUTSIDE
// the determinism perimeter (publisher-side / host-side telemetry).
// `Date` use is permitted here.

/** License tier for the pack the event references; mirrors the
 *  `LicenseClaim.kind` enum in `@stageflip/pack-format`. Duplicated
 *  here as a string literal union so the telemetry package stays a
 *  leaf (no workspace deps). */
export type PackLicenseKind = 'open' | 'paid-per-tenant' | 'enterprise';

/** Host platform the pack runs on. */
export type PackTelemetryPlatform = 'darwin' | 'linux' | 'win32' | 'unknown';

/** Pack-install event — emitted once per (tenant, pack, version) when
 *  the pack-loader successfully verifies + registers a pack. */
export interface PackInstallEvent {
  readonly kind: 'install';
  /** SHA-256 of `<publisherId>/<packId>` — anonymous identifier, no
   *  plaintext publisher / pack names ever transmitted. */
  readonly packIdHash: string;
  readonly packVersion: string;
  readonly licenseKind: PackLicenseKind;
  /** ISO 8601 UTC timestamp, second resolution
   *  (`YYYY-MM-DDTHH:MM:SSZ`). */
  readonly at: string;
  readonly engineVersion: string;
  readonly platform: PackTelemetryPlatform;
}

/** Pack-activation event — emitted once per reporting window. The
 *  `mountedAnyClip` boolean distinguishes "installed but never used"
 *  from "installed and actively used"; no per-clip detail. */
export interface PackActivationEvent {
  readonly kind: 'activation';
  readonly packIdHash: string;
  readonly packVersion: string;
  /** True iff the engine successfully mounted at least one clip from
   *  the pack during the activation window. */
  readonly mountedAnyClip: boolean;
  readonly at: string;
}

/** Pack-usage event — aggregate clip-mount count over the reporting
 *  window. No per-instance attribution; no document or scene id. */
export interface PackUsageEvent {
  readonly kind: 'usage';
  readonly packIdHash: string;
  readonly packVersion: string;
  /** Total clip-mount count over the window. Non-negative integer. */
  readonly clipMountCount: number;
  /** Window length in seconds. Non-negative integer. */
  readonly windowSeconds: number;
  readonly at: string;
}

/** Discriminated union of all pack-telemetry events. */
export type PackTelemetryEvent = PackInstallEvent | PackActivationEvent | PackUsageEvent;

/** Truncate a unix-epoch millisecond timestamp to second resolution
 *  and render as ISO 8601 UTC. */
function isoSecond(ms: number): string {
  const seconds = Math.floor(ms / 1000) * 1000;
  return new Date(seconds).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Assert that `packIdHash` is a non-empty 64-char lowercase hex
 *  string (the SHA-256 output produced by `hashPackId`). */
function assertHash(packIdHash: string): void {
  if (packIdHash.length === 0) {
    throw new Error('[pack-telemetry] packIdHash must not be empty (use hashPackId).');
  }
}

/** Build a `PackInstallEvent`. */
export function makeInstallEvent(input: {
  readonly packIdHash: string;
  readonly packVersion: string;
  readonly licenseKind: PackLicenseKind;
  readonly engineVersion: string;
  readonly platform: PackTelemetryPlatform;
  readonly nowMs: number;
}): PackInstallEvent {
  assertHash(input.packIdHash);
  return {
    kind: 'install',
    packIdHash: input.packIdHash,
    packVersion: input.packVersion,
    licenseKind: input.licenseKind,
    engineVersion: input.engineVersion,
    platform: input.platform,
    at: isoSecond(input.nowMs),
  };
}

/** Build a `PackActivationEvent`. */
export function makeActivationEvent(input: {
  readonly packIdHash: string;
  readonly packVersion: string;
  readonly mountedAnyClip: boolean;
  readonly nowMs: number;
}): PackActivationEvent {
  assertHash(input.packIdHash);
  return {
    kind: 'activation',
    packIdHash: input.packIdHash,
    packVersion: input.packVersion,
    mountedAnyClip: input.mountedAnyClip,
    at: isoSecond(input.nowMs),
  };
}

/** Build a `PackUsageEvent`. Validates `clipMountCount` and
 *  `windowSeconds` are finite non-negative integers. */
export function makeUsageEvent(input: {
  readonly packIdHash: string;
  readonly packVersion: string;
  readonly clipMountCount: number;
  readonly windowSeconds: number;
  readonly nowMs: number;
}): PackUsageEvent {
  assertHash(input.packIdHash);
  if (
    !Number.isFinite(input.clipMountCount) ||
    input.clipMountCount < 0 ||
    !Number.isInteger(input.clipMountCount)
  ) {
    throw new Error(
      `[pack-telemetry] clipMountCount must be a non-negative integer, got ${String(input.clipMountCount)}.`,
    );
  }
  if (
    !Number.isFinite(input.windowSeconds) ||
    input.windowSeconds < 0 ||
    !Number.isInteger(input.windowSeconds)
  ) {
    throw new Error(
      `[pack-telemetry] windowSeconds must be a non-negative integer, got ${String(input.windowSeconds)}.`,
    );
  }
  return {
    kind: 'usage',
    packIdHash: input.packIdHash,
    packVersion: input.packVersion,
    clipMountCount: input.clipMountCount,
    windowSeconds: input.windowSeconds,
    at: isoSecond(input.nowMs),
  };
}
