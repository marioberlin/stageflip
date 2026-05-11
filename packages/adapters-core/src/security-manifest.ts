// packages/adapters-core/src/security-manifest.ts
// `SecurityManifest` type + Zod schema for the T-446 per-provider
// data-flow security audit. Every reference adapter ships a sidecar
// `security.json` matching this shape. The `pnpm check-data-flow-security`
// CI gate validates each manifest against this schema AND against the
// adapter's `AdapterDescriptor.sandbox.kind` (manifest-vs-descriptor
// consistency).
//
// The manifest is intentionally a SIDECAR file (not a field on
// `AdapterDescriptor`) — manifests are loaded only by the CI gate +
// audit-report generators, never by runtime paths. Keeping them
// out-of-band avoids paying the cost of carrying security metadata
// through every adapter registration / dispatch.
//
// §13 statement: NOT a structural extension. No new field on
// `AdapterDescriptor`, `RIRElement`, `RIRDocument`, `ClipKindBinding`,
// or any document-tree node.
//
// Determinism: declares types + a pure Zod schema. No runtime side
// effects.

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Perimeter
// ----------------------------------------------------------------------------

/**
 * Where the adapter executes relative to the StageFlip trust boundary.
 *
 * - `in-process` — runs inline in the host process. Nothing leaves the
 *   perimeter. Examples: Kokoro TTS, AceStep music, YuE music,
 *   Stable Audio Open SFX.
 * - `sidecar-local` — runs as a local subprocess (Node or Python) on
 *   the same host. Crosses the OS process boundary but NOT the network
 *   boundary. PII handed to the sidecar stays on the host. Example:
 *   Fish Speech TTS (Python sidecar).
 * - `remote-network` — runs at a third-party HTTPS endpoint. The
 *   prompt + (where applicable) input bytes leave the StageFlip
 *   perimeter. Examples: Tripo, Meshy, Seedance, Runway.
 */
export type SecurityPerimeter = 'in-process' | 'sidecar-local' | 'remote-network';

/** Every perimeter kind, frozen. Useful for exhaustive iteration in tests. */
export const SECURITY_PERIMETERS = [
  'in-process',
  'sidecar-local',
  'remote-network',
] as const satisfies readonly SecurityPerimeter[];

// ----------------------------------------------------------------------------
// Audit-event + usage-field references
// ----------------------------------------------------------------------------

/** Subset of T-444's `AdapterAuditEvent` kinds the manifest references. */
export type RelevantAuditEventKind = 'start' | 'complete' | 'failed' | 'killed-for-resource-limit';

export const RELEVANT_AUDIT_EVENT_KINDS = [
  'start',
  'complete',
  'failed',
  'killed-for-resource-limit',
] as const satisfies readonly RelevantAuditEventKind[];

/** Subset of T-445's `AdapterUsageEvent` fields the manifest references. */
export type RelevantUsageField =
  | 'tenantId'
  | 'adapterId'
  | 'modality'
  | 'latencyMs'
  | 'costAmount'
  | 'outcome'
  | 'timestamp';

export const RELEVANT_USAGE_FIELDS = [
  'tenantId',
  'adapterId',
  'modality',
  'latencyMs',
  'costAmount',
  'outcome',
  'timestamp',
] as const satisfies readonly RelevantUsageField[];

// ----------------------------------------------------------------------------
// SecurityManifest type
// ----------------------------------------------------------------------------

/**
 * Per-adapter data-flow security declaration. Loaded by
 * `pnpm check-data-flow-security` and the audit-report generator;
 * never consumed on the runtime path.
 *
 * `networkEndpoint` is PRESENT iff `perimeter === 'remote-network'`.
 * The Zod schema enforces this invariant.
 *
 * `lastReviewedAt` is the ISO date (YYYY-MM-DD) of the most recent
 * audit cycle. Future audit reports update this field as posture
 * changes are re-verified.
 */
export interface SecurityManifest {
  /** Adapter id. Must match `AdapterDescriptor.id` (kebab-case). */
  readonly adapterId: string;
  /** Trust-boundary classification. */
  readonly perimeter: SecurityPerimeter;
  /** Which input dimensions leave the perimeter on a typical call. */
  readonly dataLeavingPerimeter: {
    /** User-supplied prompt / text input (per-modality semantics). */
    readonly prompt: boolean;
    /** User-supplied byte payload (audio / image / video reference). */
    readonly inputBytes: boolean;
    /** Tenant id (host caller). */
    readonly tenantId: boolean;
    /** Cache key (SHA-256 of canonical input). */
    readonly cacheKey: boolean;
  };
  /** PII surface this adapter accepts. */
  readonly pii: {
    /** Accepts voice-clone reference samples (raw human voice). */
    readonly voiceClone: boolean;
    /** Accepts user-uploaded media (images, audio, video, text). */
    readonly userContent: boolean;
  };
  /**
   * Network endpoint. PRESENT iff `perimeter === 'remote-network'`.
   * `hostname` is the bare DNS name (no scheme, no path).
   */
  readonly networkEndpoint?: {
    readonly hostname: string;
    readonly protocol: 'https';
    readonly authMethod: 'bearer-token' | 'api-key-header';
  };
  /** Provider-side retention posture (if any). */
  readonly dataRetention: {
    readonly providerRetainsInput: boolean;
    readonly providerRetainsOutput: boolean;
    readonly retentionDurationDays?: number;
    /**
     * - `tenant-controlled` — the tenant can configure retention via the
     *   provider's account settings.
     * - `provider-default` — the provider's ToS-stated default applies;
     *   the tenant cannot vary it at call time.
     * - `unknown` — no public retention policy at the time of review.
     */
    readonly retentionPolicy: 'tenant-controlled' | 'provider-default' | 'unknown';
  };
  /** Audit + usage signal coverage. */
  readonly auditSignal: {
    /** Subset of T-444 `AdapterAuditEvent.kind` the forensic timeline uses. */
    readonly relevantAuditEvents: ReadonlyArray<RelevantAuditEventKind>;
    /** Subset of T-445 `AdapterUsageEvent` fields the forensic timeline uses. */
    readonly relevantUsageFields: ReadonlyArray<RelevantUsageField>;
  };
  /** ISO date (YYYY-MM-DD) of the most recent audit cycle. */
  readonly lastReviewedAt: string;
}

// ----------------------------------------------------------------------------
// Zod schemas
// ----------------------------------------------------------------------------

const dataLeavingPerimeterSchema = z
  .object({
    prompt: z.boolean(),
    inputBytes: z.boolean(),
    tenantId: z.boolean(),
    cacheKey: z.boolean(),
  })
  .strict();

const piiSchema = z
  .object({
    voiceClone: z.boolean(),
    userContent: z.boolean(),
  })
  .strict();

const networkEndpointSchema = z
  .object({
    hostname: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/,
        'hostname must be lowercase DNS form (no scheme, no path)',
      ),
    protocol: z.literal('https'),
    authMethod: z.union([z.literal('bearer-token'), z.literal('api-key-header')]),
  })
  .strict();

const dataRetentionSchema = z
  .object({
    providerRetainsInput: z.boolean(),
    providerRetainsOutput: z.boolean(),
    retentionDurationDays: z.number().nonnegative().finite().optional(),
    retentionPolicy: z.union([
      z.literal('tenant-controlled'),
      z.literal('provider-default'),
      z.literal('unknown'),
    ]),
  })
  .strict();

const auditSignalSchema = z
  .object({
    relevantAuditEvents: z
      .array(
        z.union([
          z.literal('start'),
          z.literal('complete'),
          z.literal('failed'),
          z.literal('killed-for-resource-limit'),
        ]),
      )
      .min(1),
    relevantUsageFields: z
      .array(
        z.union([
          z.literal('tenantId'),
          z.literal('adapterId'),
          z.literal('modality'),
          z.literal('latencyMs'),
          z.literal('costAmount'),
          z.literal('outcome'),
          z.literal('timestamp'),
        ]),
      )
      .min(1),
  })
  .strict();

/**
 * Zod schema for `SecurityManifest`. Strict at every level: unknown
 * keys rejected. Cross-field invariant (`networkEndpoint` present iff
 * `perimeter === 'remote-network'`) enforced by `superRefine`.
 */
export const securityManifestSchema = z
  .object({
    adapterId: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'adapterId must be kebab-case (lowercase a-z0-9, hyphen-separated)',
      ),
    perimeter: z.union([
      z.literal('in-process'),
      z.literal('sidecar-local'),
      z.literal('remote-network'),
    ]),
    dataLeavingPerimeter: dataLeavingPerimeterSchema,
    pii: piiSchema,
    networkEndpoint: networkEndpointSchema.optional(),
    dataRetention: dataRetentionSchema,
    auditSignal: auditSignalSchema,
    lastReviewedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'lastReviewedAt must be ISO date YYYY-MM-DD'),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const isRemote = manifest.perimeter === 'remote-network';
    const hasEndpoint = manifest.networkEndpoint !== undefined;
    if (isRemote && !hasEndpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['networkEndpoint'],
        message: "networkEndpoint is required when perimeter === 'remote-network'",
      });
    }
    if (!isRemote && hasEndpoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['networkEndpoint'],
        message: "networkEndpoint must be absent when perimeter !== 'remote-network'",
      });
    }
  });

/**
 * Parse a candidate manifest against the Zod schema. Throws a
 * `ZodError` on failure; returns the parsed manifest on success.
 *
 * Use at gate boundaries (CI script) to catch malformed manifests
 * before validating them against the adapter descriptor.
 */
export function parseSecurityManifest(input: unknown): SecurityManifest {
  // Zod's inferred output widens optional fields with `| undefined`,
  // which `exactOptionalPropertyTypes` rejects against the declared
  // `SecurityManifest` shape. The cast is sound because the schema
  // only PERMITS the optional field to be omitted entirely (never
  // present-and-undefined). Cast scoped to this boundary.
  return securityManifestSchema.parse(input) as SecurityManifest;
}
