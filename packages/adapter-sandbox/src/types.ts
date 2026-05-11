// packages/adapter-sandbox/src/types.ts
// Core sandbox types — `SandboxRunner` interface, `SandboxInvocation` shape,
// `AdapterCredential` + `ResourceLimits` types, and `AdapterAuditEvent`
// discriminated union. Per T-444 / ADR-007 §D4.
//
// Determinism posture: this file declares types only. No runtime side effects.

import type { AdapterDescriptor } from '@stageflip/adapters-core';

// ----------------------------------------------------------------------------
// Adapter credential (scoped per-adapter; never exposes tenant-wide secrets)
// ----------------------------------------------------------------------------

/**
 * Credentials for a SINGLE adapter, scoped to one tenant. The host
 * resolves these from the `TenantAdapterCredentialsStore` and forwards
 * ONLY this object to the adapter — the adapter never sees credentials
 * for OTHER adapters even within the same tenant.
 *
 * Both fields are optional individually; an empty `{}` is rejected at
 * the storage boundary (see `TenantAdapterCredentialsStore` set
 * contract).
 */
export interface AdapterCredential {
  /** Bearer-style API key. Forwarded as `Authorization: Bearer <apiKey>`. */
  readonly apiKey?: string;
  /** Override base URL for remote-service adapters. */
  readonly baseUrl?: string;
}

// ----------------------------------------------------------------------------
// Resource limits (sidecar-only)
// ----------------------------------------------------------------------------

/**
 * Resource ceilings declared on `AdapterDescriptor.resourceLimits`.
 * Only meaningful for `sandbox.kind = 'sidecar'`. Other runners ignore.
 *
 * `maxDiskMb` is declared in v1 but ENFORCEMENT IS DEFERRED to T-447
 * (cgroups-based enforcer needs production hardening); the field is
 * validated but not yet acted upon by the v1 `SidecarSandboxRunner`.
 */
export interface ResourceLimits {
  readonly maxMemoryMb?: number;
  readonly maxCpuMs?: number;
  readonly maxDiskMb?: number;
}

// ----------------------------------------------------------------------------
// Sandbox invocation
// ----------------------------------------------------------------------------

/**
 * Per-call envelope passed into `SandboxRunner.run`. Carries the
 * descriptor (read for sandbox kind, runtime, baseUrlEnvVar,
 * resourceLimits), the tenant id (audit-event attribute), the
 * scoped credential (or null), the input payload, and the audit
 * emitter the runner will fire events into.
 *
 * `input` is `unknown` because the runner doesn't introspect it; the
 * per-modality protocol (TTS / 3D / etc.) owns the shape and is
 * forwarded verbatim into the sandbox process / HTTPS body / in-
 * process callable.
 */
export interface SandboxInvocation {
  readonly descriptor: AdapterDescriptor;
  readonly tenantId: string;
  readonly credential: AdapterCredential | null;
  readonly input: unknown;
  readonly auditEmitter: AuditEmitter;
}

// ----------------------------------------------------------------------------
// Audit events (T-446 consumer-ready shape)
// ----------------------------------------------------------------------------

/**
 * Discriminated audit event union. Every adapter invocation emits
 * `start` immediately, then ONE of `complete` / `failed` /
 * `killed-for-resource-limit`. T-446 ratifies this shape; the field
 * set must remain backwards-compatible (new optional fields OK; existing
 * fields cannot be removed or have their type narrowed).
 */
export type AdapterAuditEvent =
  | {
      readonly kind: 'start';
      readonly adapterId: string;
      readonly modality: string;
      readonly tenantId: string;
      readonly sandboxKind: string;
    }
  | {
      readonly kind: 'complete';
      readonly adapterId: string;
      readonly modality: string;
      readonly tenantId: string;
      readonly sandboxKind: string;
      /** Optional wall-clock duration; omitted when no clock supplied. */
      readonly durationMs?: number;
    }
  | {
      readonly kind: 'failed';
      readonly adapterId: string;
      readonly modality: string;
      readonly tenantId: string;
      readonly sandboxKind: string;
      readonly errorMessage: string;
    }
  | {
      readonly kind: 'killed-for-resource-limit';
      readonly adapterId: string;
      readonly modality: string;
      readonly tenantId: string;
      readonly sandboxKind: 'sidecar';
      readonly dimension: 'cpu' | 'memory' | 'disk';
    };

/**
 * Pluggable audit-event sink. Default in-memory impl in
 * `audit-emitter.ts`; T-446 wires a `CloudLoggingAuditEmitter`.
 *
 * `emit(event)` is sync — no I/O in v1 (the in-memory impl appends
 * to a ring buffer). Future async transports MAY queue the event
 * internally and return immediately.
 */
export interface AuditEmitter {
  emit(event: AdapterAuditEvent): void;
}

// ----------------------------------------------------------------------------
// SandboxRunner — the interface every runner implements
// ----------------------------------------------------------------------------

/**
 * One sandbox kind, one runner. The host picks the runner for an
 * adapter by reading `descriptor.sandbox.kind` and dispatching via
 * `SandboxFactory.pick(descriptor)`.
 *
 * `run` is generic on the input/output payload only at the boundary
 * (declared by the caller); inside the runner the payload is opaque.
 * The runner is responsible for:
 *   - Emitting the `start` audit event before invoking the adapter.
 *   - Emitting the matching terminal event (`complete` / `failed` /
 *     `killed-for-resource-limit`) after.
 *   - For sidecar: spawning / killing the child process + enforcing
 *     resource limits.
 *   - For remote-service: building the request URL + headers +
 *     forwarding the input as the body.
 *   - For in-process: invoking the host-supplied callable directly.
 */
export interface SandboxRunner {
  run<TOut>(invocation: SandboxInvocation): Promise<TOut>;
}
