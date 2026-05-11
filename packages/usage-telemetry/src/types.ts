// packages/usage-telemetry/src/types.ts
// Per-modality usage telemetry types (T-445 — Phase 14 δ first task).
// `AdapterUsageEvent` is the metrics-class event emitted alongside (not
// inside) T-444's security-class `AdapterAuditEvent`. The two share a
// common provenance (every adapter call emits both) but live in
// different transports — audit fans out to the T-446 security pipeline,
// usage fans out to the per-tenant metrics surface.
//
// Determinism posture: this file declares types + a Zod schema only.
// The schema is pure (no clock / RNG / I/O at construction).

import { z } from 'zod';

// ----------------------------------------------------------------------------
// AdapterUsageEvent
// ----------------------------------------------------------------------------

/** Why the host picked this adapter for the invocation. */
export const USAGE_SELECTED_REASONS = ['capability-router', 'explicit'] as const;
export type UsageSelectedReason = (typeof USAGE_SELECTED_REASONS)[number];

/** Terminal outcome of the invocation — mirrors T-444 audit terminal kinds. */
export const USAGE_OUTCOMES = ['success', 'failed', 'killed'] as const;
export type UsageOutcome = (typeof USAGE_OUTCOMES)[number];

/**
 * `AdapterUsageEvent` — one event per adapter invocation. Always emitted
 * AFTER the matching `AdapterAuditEvent` terminal event (so the
 * `outcome` is known). Lives in a separate transport from the audit
 * event; consumers MAY join the two on `(tenantId, adapterId,
 * timestamp)` for cross-correlation.
 *
 * The shape is strict: T-446 ratifies it, future fields land as optional
 * additions only (no field removals / type narrowings post-T-445).
 */
export interface AdapterUsageEvent {
  /** Tenant the invocation belongs to. */
  readonly tenantId: string;
  /** Adapter identifier — kebab-case per AdapterDescriptor.id. */
  readonly adapterId: string;
  /** Modality kind — string-typed to stay decoupled from adapters-core. */
  readonly modality: string;
  /** Whether the capability-router ranked the adapter or the caller chose explicitly. */
  readonly selectedReason: UsageSelectedReason;
  /** Wall-clock duration from `SandboxRunner.run` invocation to result, in milliseconds. */
  readonly latencyMs: number;
  /** Cost incurred by this call, in `costCurrency`. Free adapters report `0`. */
  readonly costAmount: number;
  /** ISO-4217 alpha-3 currency code for `costAmount`. */
  readonly costCurrency: string;
  /** Terminal outcome — `'success'` | `'failed'` | `'killed'`. */
  readonly outcome: UsageOutcome;
  /** Wall-clock timestamp (ISO-8601) — captured at the END of the invocation. */
  readonly timestamp: string;
}

/**
 * Strict Zod schema for `AdapterUsageEvent`. Use `parse` to validate
 * inbound events at transport boundaries (the in-memory emitter does
 * NOT re-validate — callers are trusted to produce well-formed events;
 * the schema is the source of truth for serialization / cross-process
 * transport).
 */
export const adapterUsageEventSchema: z.ZodType<AdapterUsageEvent> = z
  .object({
    tenantId: z.string().min(1),
    adapterId: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'adapterId must be kebab-case'),
    modality: z.string().min(1).max(64),
    selectedReason: z.enum(USAGE_SELECTED_REASONS),
    latencyMs: z.number().nonnegative().finite(),
    costAmount: z.number().nonnegative().finite(),
    costCurrency: z.string().regex(/^[A-Z]{3}$/),
    outcome: z.enum(USAGE_OUTCOMES),
    timestamp: z.string().datetime(),
  })
  .strict();

// ----------------------------------------------------------------------------
// Pluggable emitter / reader
// ----------------------------------------------------------------------------

/**
 * Pluggable usage-event sink. Default in-memory impl in
 * `in-memory-emitter.ts`. Production transports (Cloud Logging,
 * Prometheus, OTLP) land downstream — T-445 ships only the seam.
 *
 * `emit(event)` is sync — no I/O in the in-memory default. Async
 * transports MAY queue internally and return immediately.
 */
export interface UsageTelemetryEmitter {
  emit(event: AdapterUsageEvent): void;
}

/**
 * Dual of `UsageTelemetryEmitter` — read-side surface for the
 * `query_usage_telemetry` tool. Returns events for a single tenant in
 * emission order (oldest first). Implementations that back onto an
 * external store (Cloud Logging) issue a query under the hood; the
 * in-memory default returns a filtered snapshot of its ring buffer.
 */
export interface UsageTelemetryReader {
  eventsForTenant(tenantId: string): readonly AdapterUsageEvent[];
}
