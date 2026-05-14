// packages/runtime-on-device-player/src/contract.ts
// Public types for the on-device display player runtime shim (T-399). The
// shim is the abstraction layer the on-device player binary (T-400, future)
// calls into to mount + run interactive clips on physical display hardware
// (DOOH, digital signage, in-venue screens). Per ADR-005 §D4, on-device is
// the third deployment target for the interactive runtime tier; per
// ADR-005 §D5, live-mount requires `features.interactive === 'ga'`.
//
// The canonical 3-state enum `features.interactive` is owned by the
// schema layer (`@stageflip/storage` settings + `@stageflip/runtimes-
// interactive` host cache). We re-export the type from the latter so
// this package never restates the canonical triple — the
// cross-layer-drift gate (`scripts/check-feature-flag-wiring.ts`) is
// the source of truth.

/**
 * Hardware capability descriptor. The on-device player binary fills this
 * on boot via `OnDevicePlayerShim.boot`. The shim uses the booleans to
 * gate clip families whose `liveMount` requires specific hardware (e.g.
 * a shader clip needs `hasGpu`; a voice clip needs `hasMicrophone`).
 */
export interface DisplayDeviceCapability {
  readonly deviceId: string;
  readonly hardwareClass: 'dooh' | 'signage' | 'in-venue' | 'unknown';
  readonly resolution: { readonly width: number; readonly height: number };
  readonly refreshHz: number;
  readonly hasGpu: boolean;
  readonly hasAudio: boolean;
  readonly hasNetwork: boolean;
  readonly hasMicrophone: boolean;
  readonly hasCamera: boolean;
  readonly osPlatform: 'linux' | 'darwin' | 'win32' | 'android' | 'embedded';
  readonly playerVersion: string;
}

/**
 * Per-mount context the shim assembles for downstream consumers (the
 * binary inspects this for diagnostics; the shim threads it through the
 * harness as needed). Kept as a public type so T-400 (binary packaging)
 * and T-401 (telemetry) can build on the same shape.
 */
export interface OnDevicePlayerContext {
  readonly tenantId: string;
  readonly device: DisplayDeviceCapability;
  readonly tenantPolicy: { readonly featuresInteractive: TenantFlagValue };
  /** Monotonic ms-since-boot clock; provided by the binary at `boot` time. */
  readonly clock: () => number;
  readonly emitTelemetry: (event: TelemetryEvent) => void;
}

// Re-export the canonical 3-state toggle from the interactive tier; the
// on-device player consumes the same enum so the values stay in lock-
// step with the schema + admin + permission-shim wiring.
export type { TenantFlagValue } from '@stageflip/runtimes-interactive';

import type { TenantFlagValue } from '@stageflip/runtimes-interactive';

/**
 * Refusal reasons emitted by the shim when live-mount cannot proceed.
 * The binary uses the reason to render the appropriate `staticFallback`
 * and to surface a diagnostic to the operator.
 */
export type OnDevicePlayerRefusalReason =
  | 'tenant-flag-disabled'
  | 'preview-not-ga'
  | 'permission-refused'
  | 'capability-insufficient'
  | 'no-factory-registered';

/**
 * Telemetry seam consumed by T-401 (on-device-player ops + telemetry).
 * The binary or T-401 wires the real sink; the shim is sink-agnostic.
 */
export type TelemetryEvent =
  | { readonly kind: 'boot'; readonly device: DisplayDeviceCapability }
  | { readonly kind: 'mount-attempted'; readonly clipFamily: string; readonly clipId: string }
  | {
      readonly kind: 'mount-refused';
      readonly reason: OnDevicePlayerRefusalReason;
      readonly clipFamily: string;
      readonly clipId: string;
    }
  | {
      readonly kind: 'mount-success';
      readonly clipFamily: string;
      readonly clipId: string;
      readonly elapsedMs: number;
    }
  | { readonly kind: 'unmount'; readonly clipId: string; readonly clipFamily: string }
  | { readonly kind: 'shutdown'; readonly clipsUnmounted: number };
