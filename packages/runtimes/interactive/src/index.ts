// packages/runtimes/interactive/src/index.ts
// @stageflip/runtimes-interactive — the interactive runtime tier per
// ADR-003 §D1 + T-306. The package mounts `liveMount` for HTML / live
// presentation / display-interactive / on-device-player exports. It is
// out-of-scope for `check-determinism` per ADR-003 §D5 (T-306 lands the
// exemption; T-309 lands the shader sub-rule).
//
// Public surface:
//   - Contract types — MountContext, MountHandle, ClipFactory, TenantPolicy.
//   - Registry — InteractiveClipRegistry + the singleton.
//   - PermissionShim — mount-time permission gate.
//   - InteractiveMountHarness — programmatic mount/unmount/dispose.
//   - renderStaticFallback — fallback render helper.
//   - contractTestSuite (via './contract-tests') — Vitest describe block
//     for Phase γ family validation.
//
// See `skills/stageflip/concepts/runtimes/SKILL.md`.

export {
  type ClipFactory,
  type MountContext,
  type MountHandle,
  PERMISSIVE_TENANT_POLICY,
  type TenantPolicy,
} from './contract.js';
export {
  renderStaticFallback,
  type StaticFallbackHandle,
} from './fallback-rendering.js';
export {
  InteractiveClipNotRegisteredError,
  InteractiveMountHarness,
  type InteractiveMountHarnessOptions,
  registerInteractiveClip,
} from './mount-harness.js';
export {
  defaultPermissionBrowserApi,
  type EmitTelemetry,
  NOOP_EMIT_TELEMETRY,
  type PermissionBrowserApi,
  type PermissionResult,
  PermissionShim,
  type PermissionShimOptions,
} from './permission-shim.js';
export {
  InteractiveClipFamilyAlreadyRegisteredError,
  InteractiveClipRegistry,
  interactiveClipRegistry,
} from './registry.js';
