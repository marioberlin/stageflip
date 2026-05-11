// packages/adapters-core/src/index.ts
// Public surface of `@stageflip/adapters-core`. T-418 ships:
//
//   - `AdapterDescriptor` type + `adapterDescriptorSchema` Zod schema
//     (verbatim from ADR-007 §D1) + `parseAdapterDescriptor` helper.
//   - `AdapterRegistry` — in-memory adapter map keyed by
//     `(modality.kind, id)`.
//   - `CapabilityDescriptorParser` — pluggable per-modality validator
//     dispatch shell. T-419 ships the first concrete validators.
//   - `LicenseGate` interface + `defaultLicenseGate` impl per ADR-007 §D3
//     + THIRD_PARTY.md whitelist.
//   - `FallbackChainExecutor` — sequential adapter chain with telemetry
//     emit per failure.
//
// Pure contracts + in-memory dispatch. No real adapter implementations
// (T-426..T-434). No per-modality call shapes (T-419).

export {
  ADAPTER_LICENSE_KINDS,
  ADAPTER_MODALITY_KINDS,
  SANDBOX_KINDS,
  adapterDescriptorSchema,
  parseAdapterDescriptor,
} from './adapter-descriptor.js';
export type {
  AdapterDescriptor,
  AdapterLicenseKind,
  AdapterLicensePosture,
  AdapterModality,
  AdapterModalityKind,
  CapabilityDescriptor,
  CostHint,
  LatencyHint,
  SandboxKind,
  SandboxModel,
} from './adapter-descriptor.js';

export { AdapterRegistry } from './registry.js';

export { buildValidatorMap, CapabilityDescriptorParser } from './capability-parser.js';
export type {
  CapabilityValidationResult,
  CapabilityValidator,
  ParseResult,
} from './capability-parser.js';

export { defaultLicenseGate, TENANT_LICENSE_POSTURES } from './license-gate.js';
export type {
  LicenseGate,
  LicenseGateDecision,
  TenantContext,
  TenantLicensePosture,
} from './license-gate.js';

export { ADAPTER_FALLBACK_FAILURE_EVENT, FallbackChainExecutor } from './fallback-executor.js';
export type { AdapterError, ExecuteOptions, ExecuteResult } from './fallback-executor.js';

export { noopEmitTelemetry } from './telemetry.js';
export type { EmitTelemetry } from './telemetry.js';
