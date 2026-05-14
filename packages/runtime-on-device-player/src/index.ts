// packages/runtime-on-device-player/src/index.ts
// @stageflip/runtime-on-device-player — runtime shim the on-device display
// player binary (T-400, future) calls into to mount + run interactive clips
// on physical display hardware (DOOH, digital signage, in-venue screens).
// Per ADR-005 §D4 + §D5, on-device-player live-mount is GA-only; preview
// posture keeps it on `staticFallback`. See
// `skills/stageflip/concepts/on-device-player/SKILL.md`.

export type {
  DisplayDeviceCapability,
  OnDevicePlayerContext,
  OnDevicePlayerRefusalReason,
  TelemetryEvent,
  TenantFlagValue,
} from './contract.js';

export type { OnDeviceClipHandle } from './lifecycle.js';

export {
  evaluateTenantGate,
  type TenantGateDecision,
} from './tenant-gate.js';

export {
  type CreateOnDevicePlayerShimDeps,
  createOnDevicePlayerShim,
  type OnDevicePlayerMountArgs,
  type OnDevicePlayerMountResult,
  type OnDevicePlayerShim,
} from './shim.js';
