// packages/asset-gen-contract/src/tenant-voice-consent-store.ts
// `TenantVoiceConsentStore` facet interface + `TenantVoiceConsentRow`
// shape + Zod schema. Per ADR-008 §D4.
//
// A separate storage facet from `StorageAdapter` (doc-scoped) and from
// `TenantSettingsStore` (per-tenant settings blob) — voice consent rows
// are append-mostly + audit-load-bearing; bundling them into the JSON-
// shaped `TenantSettings` blob would (a) bloat every settings-read with
// consent rows, (b) make per-row revocation timestamps awkward, (c) make
// per-row audit-log emission require diffing JSON instead of inserting
// rows.
//
// The carve-out matches T-411a's `TenantSettingsStore` carve-out from
// generic `StorageAdapter`. Per ADR-008 §D4 D-VOICE-CONSENT-2, "a
// dedicated facet matches how `TenantSettingsStore` itself was carved out
// from generic `StorageAdapter` per T-411a."
//
// T-419 ships only the interface + the Zod schema; concrete adapter
// implementations (in-memory, Firebase, Postgres) are downstream and
// triggered by T-427 (`@stageflip/tts-fish-speech` — the v1 voice-clone
// adapter that is the first consent consumer).

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Grant basis enumeration (ADR-008 §D4)
// ----------------------------------------------------------------------------

/**
 * The basis on which a tenant admin declared voice-clone consent. Per
 * ADR-008 §D4 D-VOICE-CONSENT-1.
 *
 * - `self`                  — the voice belongs to the admin themselves.
 * - `third-party-signed`    — the voice belongs to a person who has signed
 *                              a consent form the admin can produce on
 *                              demand.
 * - `public-figure`         — public-figure usage; tenant accepts legal
 *                              liability.
 *
 * New grant bases require an ADR-008 amendment + this enum's expansion
 * (per ADR-008 §"Ongoing").
 */
export const TENANT_VOICE_CONSENT_GRANT_BASES = [
  'self',
  'third-party-signed',
  'public-figure',
] as const;
export type TenantVoiceConsentGrantBasis = (typeof TENANT_VOICE_CONSENT_GRANT_BASES)[number];

// ----------------------------------------------------------------------------
// TenantVoiceConsentRow (ADR-008 §D4)
// ----------------------------------------------------------------------------

/**
 * A single voice-clone consent row. Per-tenant + per-(provider, voice)
 * pair. Append-mostly; revocation flips `revokedAt` rather than deleting
 * the row (preserves audit trail).
 *
 * Per ADR-008 §D4 D-VOICE-CONSENT-2.
 */
export interface TenantVoiceConsentRow {
  /** ULID. Stable consent-row id. */
  readonly id: string;
  /** Tenant the consent was granted to. */
  readonly tenantId: string;
  /** Voice provider identifier (e.g. `'fish-speech'`, `'coqui-xtts'`). */
  readonly voiceProvider: string;
  /** Provider's slug for the cloned voice. */
  readonly voiceId: string;
  /** Admin user id who declared consent. */
  readonly grantedBy: string;
  /** ISO 8601 timestamp of grant. */
  readonly grantedAt: string;
  /** Basis on which consent was declared (per §D4 D-VOICE-CONSENT-1). */
  readonly grantBasis: TenantVoiceConsentGrantBasis;
  /**
   * Free-text note the admin attaches at declaration time (e.g. consent-
   * form file ref). Optional.
   */
  readonly evidenceUri?: string;
  /**
   * Set when the admin (or downstream automation) revokes the consent.
   * ISO 8601. `assertActive` MUST treat any row with `revokedAt` set as
   * absent for the purposes of consent enforcement.
   */
  readonly revokedAt?: string;
}

/** Zod schema validating a `TenantVoiceConsentRow`. Strict. */
export const tenantVoiceConsentRowSchema = z
  .object({
    id: z.string().min(1),
    tenantId: z.string().min(1),
    voiceProvider: z.string().min(1),
    voiceId: z.string().min(1),
    grantedBy: z.string().min(1),
    grantedAt: z.string().min(1),
    grantBasis: z.enum(TENANT_VOICE_CONSENT_GRANT_BASES),
    evidenceUri: z.string().min(1).optional(),
    revokedAt: z.string().min(1).optional(),
  })
  .strict();

// ----------------------------------------------------------------------------
// `assertActive` input + create input
// ----------------------------------------------------------------------------

/**
 * Input shape `assertActive` consumes. Adapters call this at every
 * cloned-voice synthesize() call (per §D4 D-VOICE-CONSENT-3 — per-call
 * checking, no session caching).
 */
export interface AssertActiveInput {
  readonly tenantId: string;
  readonly voiceProvider: string;
  readonly voiceId: string;
}

/**
 * Input shape `create` consumes. The store assigns `id` (ULID) and
 * `grantedAt` (ISO 8601 of insertion time); callers omit both.
 */
export type CreateTenantVoiceConsentInput = Omit<TenantVoiceConsentRow, 'id' | 'grantedAt'>;

// ----------------------------------------------------------------------------
// TenantVoiceConsentStore (ADR-008 §D4)
// ----------------------------------------------------------------------------

/**
 * Storage facet for per-tenant voice-clone consent rows. Per ADR-008 §D4.
 *
 * Concrete adapters (in-memory, Firebase, Postgres) implement this
 * contract; consumers pick the adapter at boot. Implementations are
 * downstream of T-419; the interface itself ships here.
 *
 * **`assertActive` is the only method that throws.** It throws when the
 * row is absent OR `revokedAt` is set. This is intentional: it forces
 * adapters to handle the refusal explicitly and prevents accidental
 * fall-through-to-success. The TTS adapter's pre-call hook propagates
 * the refusal as `LF-VOICE-CONSENT-MISSING` (per ADR-008 §D11).
 *
 * **No per-session consent caching.** A revocation must take effect
 * immediately — the in-memory `assertActive` cost is one indexed
 * `(tenantId, voiceProvider, voiceId)` lookup; downstream adapters keep
 * it fast (per §D4 ratification D — alternative D rejected).
 */
export interface TenantVoiceConsentStore {
  /** Read a row by id. Returns `undefined` when no row exists. */
  get(id: string): Promise<TenantVoiceConsentRow | undefined>;

  /**
   * List every consent row for a tenant. Returns an empty array when no
   * rows exist. Used by the consent-admin UI surface (sibling task to
   * T-411e — not specced here).
   */
  listForTenant(tenantId: string): Promise<readonly TenantVoiceConsentRow[]>;

  /**
   * Per-call active-consent check. Throws when no active row matches the
   * `(tenantId, voiceProvider, voiceId)` triple. Returns the matching row
   * on success.
   *
   * "Active" means: row exists AND `revokedAt` is unset.
   */
  assertActive(input: AssertActiveInput): Promise<TenantVoiceConsentRow>;

  /**
   * Insert a new consent row. Implementations assign `id` (ULID) and
   * `grantedAt` (ISO 8601 of insertion time) and persist the row.
   * Returns the persisted row.
   */
  create(input: CreateTenantVoiceConsentInput): Promise<TenantVoiceConsentRow>;

  /**
   * Mark an existing row revoked. `revokedAt` is the ISO 8601 timestamp
   * of revocation (caller-supplied so the storage layer doesn't need a
   * clock dep). After this resolves, `assertActive` for the same triple
   * MUST throw.
   */
  revoke(id: string, revokedAt: string): Promise<void>;
}
