// packages/adapters-core/src/adapter-descriptor.ts
// `AdapterDescriptor` type + Zod schema — verbatim from ADR-007 §D1.
// Every adapter that participates in the Provider Seam (asset generation,
// live audience, marketplace bundles) exposes a static descriptor of this
// shape. The routing engine (T-425) consumes this object — and only this
// object — when deciding whether to instantiate the adapter for a given
// call.
//
// `capability` is opaque — modality-specific shapes are validated by per-
// modality validators registered into `CapabilityDescriptorParser`. The
// modality envelope itself (ADR-007 §D1) is a discriminated union; the
// exhaustive set of 14 kinds is enumerated below and matched in the Zod
// schema.

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Modality
// ----------------------------------------------------------------------------

/**
 * Adapter modality. Discriminated union over the 14 kinds enumerated in
 * ADR-007 §D1 (5 Phase 14 β + 7 source-grounded + 1 research-session +
 * 1 Phase 15 + 1 Phase 16). Expanded per consumer ADR; new modalities
 * extend this union plus the matching schema below.
 */
export type AdapterModality =
  // Phase 14 β modalities (asset generation):
  | { readonly kind: 'tts' }
  | { readonly kind: 'video-gen' }
  | { readonly kind: 'music-gen' }
  | { readonly kind: 'sfx' }
  | { readonly kind: 'three-d' }
  // Phase 14 source-grounded modalities (per ADR-007 §D6 / proposal §2.4):
  | { readonly kind: 'slide-deck-gen' }
  | { readonly kind: 'mind-map-gen' }
  | { readonly kind: 'table-gen' }
  | { readonly kind: 'quiz-gen' }
  | { readonly kind: 'flashcard-gen' }
  | { readonly kind: 'report-gen' }
  | { readonly kind: 'infographic-gen' }
  // Source-grounded session provider:
  | { readonly kind: 'research-session' }
  // Phase 15 modalities (live audience):
  | { readonly kind: 'audience-backend' }
  // Phase 16 modalities (marketplace):
  | { readonly kind: 'bundle' };

/** Every modality kind, frozen. Useful for exhaustive iteration in tests. */
export const ADAPTER_MODALITY_KINDS = [
  'tts',
  'video-gen',
  'music-gen',
  'sfx',
  'three-d',
  'slide-deck-gen',
  'mind-map-gen',
  'table-gen',
  'quiz-gen',
  'flashcard-gen',
  'report-gen',
  'infographic-gen',
  'research-session',
  'audience-backend',
  'bundle',
] as const satisfies readonly AdapterModality['kind'][];

export type AdapterModalityKind = (typeof ADAPTER_MODALITY_KINDS)[number];

// ----------------------------------------------------------------------------
// License posture
// ----------------------------------------------------------------------------

/**
 * License posture an adapter ships under. Routing layer filters per tenant
 * policy (ADR-007 §D3); `gpl-incompatible` is refused unconditionally
 * (CLAUDE.md §3 / `pnpm check-licenses` whitelist invariant).
 */
export type AdapterLicensePosture =
  | { readonly kind: 'apache-2.0' }
  | { readonly kind: 'mit' }
  | { readonly kind: 'cc-by' }
  | { readonly kind: 'proprietary-byo' }
  | { readonly kind: 'proprietary-vendored' }
  | { readonly kind: 'gpl-incompatible' };

/** Every license posture kind, frozen. */
export const ADAPTER_LICENSE_KINDS = [
  'apache-2.0',
  'mit',
  'cc-by',
  'proprietary-byo',
  'proprietary-vendored',
  'gpl-incompatible',
] as const satisfies readonly AdapterLicensePosture['kind'][];

export type AdapterLicenseKind = (typeof ADAPTER_LICENSE_KINDS)[number];

// ----------------------------------------------------------------------------
// Sandbox
// ----------------------------------------------------------------------------

/**
 * Sandbox model — declares the runtime isolation level the adapter needs.
 * Per ADR-007 §D4. The host environment declares which kinds it supports;
 * the routing layer refuses adapters whose declared sandbox exceeds host
 * capability and surfaces `LF-ADAPTER-SANDBOX-UNAVAILABLE`.
 */
export type SandboxModel =
  | { readonly kind: 'in-process' }
  | { readonly kind: 'sidecar'; readonly runtime: 'node' | 'python' }
  | { readonly kind: 'remote-service'; readonly baseUrlEnvVar: string }
  | { readonly kind: 'wasm-sandbox' };

/** Every sandbox kind, frozen. */
export const SANDBOX_KINDS = [
  'in-process',
  'sidecar',
  'remote-service',
  'wasm-sandbox',
] as const satisfies readonly SandboxModel['kind'][];

export type SandboxKind = (typeof SANDBOX_KINDS)[number];

// ----------------------------------------------------------------------------
// Cost / latency hints
// ----------------------------------------------------------------------------

/**
 * Cost hint for the routing engine. Adapter authors document a representative
 * call; the engine uses these to rank candidates when multiple satisfy the
 * capability filter. Optional — adapters with no cost surface (e.g.,
 * in-process / free) omit.
 */
export interface CostHint {
  readonly usd?: number;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
}

/**
 * Latency hint for the routing engine. p50 + p95 milliseconds for a
 * representative call. Optional.
 */
export interface LatencyHint {
  readonly p50?: number;
  readonly p95?: number;
}

// ----------------------------------------------------------------------------
// Capability descriptor (opaque envelope)
// ----------------------------------------------------------------------------

/**
 * Capability descriptor — modality-specific shape with a uniform envelope.
 * Adapters-core treats this as opaque. Per-modality validators registered
 * into `CapabilityDescriptorParser` (T-419 ships the first ones for
 * asset-gen modalities) own the per-shape contract.
 */
export type CapabilityDescriptor = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// AdapterDescriptor
// ----------------------------------------------------------------------------

/**
 * The static descriptor every adapter exposes. Verbatim from ADR-007 §D1.
 *
 * `id` is globally unique kebab-case across the registry (per modality —
 * the same `id` MAY repeat across modalities for an adapter that ships
 * multiple modalities). The pair `(modality.kind, id)` is the registry key.
 *
 * `sourceGrounded` + `requiresResearchProvider` come from ADR-007 §D5 / D6
 * (source-grounded providers proposal §2.1). When both are set, the
 * routing engine pairs the adapter with a `ResearchSessionProvider` at
 * call time.
 */
export interface AdapterDescriptor {
  /** Adapter id. Globally unique within (modality.kind, id). Kebab-case. */
  readonly id: string;
  /** What this adapter does. Discriminated union; expanded per consumer ADR. */
  readonly modality: AdapterModality;
  /** Modality-specific capability shape. Opaque to the registry. */
  readonly capability: CapabilityDescriptor;
  /** License posture; routing layer filters per tenant policy. */
  readonly license: AdapterLicensePosture;
  /** Sandbox model; routing layer refuses if declared > host capability. */
  readonly sandbox: SandboxModel;
  /** Cost hint for routing-engine ranking. Optional. */
  readonly costPerCall?: CostHint;
  /** Latency hint for routing-engine ranking. Optional. */
  readonly latencyMs?: LatencyHint;
  /**
   * From source-grounded-providers proposal §2.1 (D6). Declares whether
   * this adapter accepts a research-session-scoped source corpus.
   */
  readonly sourceGrounded?: boolean;
  /**
   * From source-grounded-providers proposal §2.1 (D5). When set, names the
   * `ResearchSessionProvider` this adapter is paired with at manifest time.
   * Routing engine does not infer relationships.
   */
  readonly requiresResearchProvider?: string;
}

// ----------------------------------------------------------------------------
// Zod schemas
// ----------------------------------------------------------------------------

const adapterModalitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tts') }),
  z.object({ kind: z.literal('video-gen') }),
  z.object({ kind: z.literal('music-gen') }),
  z.object({ kind: z.literal('sfx') }),
  z.object({ kind: z.literal('three-d') }),
  z.object({ kind: z.literal('slide-deck-gen') }),
  z.object({ kind: z.literal('mind-map-gen') }),
  z.object({ kind: z.literal('table-gen') }),
  z.object({ kind: z.literal('quiz-gen') }),
  z.object({ kind: z.literal('flashcard-gen') }),
  z.object({ kind: z.literal('report-gen') }),
  z.object({ kind: z.literal('infographic-gen') }),
  z.object({ kind: z.literal('research-session') }),
  z.object({ kind: z.literal('audience-backend') }),
  z.object({ kind: z.literal('bundle') }),
]);

const adapterLicensePostureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('apache-2.0') }),
  z.object({ kind: z.literal('mit') }),
  z.object({ kind: z.literal('cc-by') }),
  z.object({ kind: z.literal('proprietary-byo') }),
  z.object({ kind: z.literal('proprietary-vendored') }),
  z.object({ kind: z.literal('gpl-incompatible') }),
]);

const sandboxModelSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('in-process') }),
  z.object({
    kind: z.literal('sidecar'),
    runtime: z.union([z.literal('node'), z.literal('python')]),
  }),
  z.object({ kind: z.literal('remote-service'), baseUrlEnvVar: z.string().min(1) }),
  z.object({ kind: z.literal('wasm-sandbox') }),
]);

const costHintSchema = z
  .object({
    usd: z.number().nonnegative().optional(),
    tokensIn: z.number().nonnegative().int().optional(),
    tokensOut: z.number().nonnegative().int().optional(),
  })
  .strict();

const latencyHintSchema = z
  .object({
    p50: z.number().nonnegative().optional(),
    p95: z.number().nonnegative().optional(),
  })
  .strict();

/**
 * Zod schema for `AdapterDescriptor`. Strict: unknown top-level keys are
 * rejected. `capability` is `record(unknown)` — opaque; per-modality
 * validators (T-419+) enforce shape.
 *
 * Kebab-case `id` enforced by regex (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
 */
export const adapterDescriptorSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'id must be kebab-case (lowercase a-z0-9, hyphen-separated)',
      ),
    modality: adapterModalitySchema,
    capability: z.record(z.unknown()),
    license: adapterLicensePostureSchema,
    sandbox: sandboxModelSchema,
    costPerCall: costHintSchema.optional(),
    latencyMs: latencyHintSchema.optional(),
    sourceGrounded: z.boolean().optional(),
    requiresResearchProvider: z.string().min(1).optional(),
  })
  .strict();

/**
 * Parse a candidate descriptor against the Zod schema. Throws a `ZodError`
 * on failure; returns the parsed (immutable-shaped) descriptor on success.
 *
 * Use at adapter-registration boundaries to catch malformed descriptors
 * before they enter the registry. The registry itself does not re-parse
 * (avoids double-cost on hot paths).
 */
export function parseAdapterDescriptor(input: unknown): AdapterDescriptor {
  // Zod's inferred output type widens optional fields with `| undefined`,
  // which `exactOptionalPropertyTypes` rejects against the declared
  // `AdapterDescriptor` shape (optional fields not present vs. present-and-
  // undefined). The cast is sound because the schema only PERMITS the
  // optional field to be omitted entirely (we don't permit explicit
  // `undefined`), so any successfully parsed object matches the declared
  // type. Cast is scoped to this boundary.
  return adapterDescriptorSchema.parse(input) as AdapterDescriptor;
}
