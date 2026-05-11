// packages/audience-contract/src/loss-flags.ts
// Eight `LF-AUDIENCE-*` loss-flag codes. Verbatim from ADR-009 §D11.
//
// `@stageflip/loss-flags` types codes as opaque strings (per the package
// contract); this file is the canonical, sealed inventory the audience
// stack emits against. Consumers (T-453 backend, T-454 runtime,
// T-461..T-471 clips) import the union type when emitting via
// `emitLossFlag` from `@stageflip/loss-flags`.

/**
 * Severity per ADR-009 §D11. Mirrors the `LossFlagSeverity` taxonomy from
 * `@stageflip/loss-flags` (kept independent here to avoid a workspace dep
 * the package does not otherwise need — the inventory is read by the
 * emit-site code that already imports `@stageflip/loss-flags`).
 */
export type AudienceLossFlagSeverity = 'info' | 'warn' | 'error';

/** Per-code metadata describing severity, category, and emission condition. */
export interface AudienceLossFlagSpec {
  readonly code: string;
  readonly severity: AudienceLossFlagSeverity;
  /** Always `'other'` for audience codes per ADR-009 §D11. */
  readonly category: 'other';
  /** Plain-English description of the condition that triggers the flag. */
  readonly description: string;
}

/**
 * Sealed inventory of audience loss-flag codes. Per ADR-009 §D11.
 *
 * Eight codes, ordered to match the §D11 table verbatim:
 *
 * 1. `LF-AUDIENCE-TENANT-RATE-LIMITED` — warn — per-tenant ingest rate exceeded (T-453)
 * 2. `LF-AUDIENCE-VOTER-RATE-LIMITED` — info — per-voter rate exceeded; vote dropped silently (T-453)
 * 3. `LF-AUDIENCE-SESSION-CLOSED` — info — voter submitted after session close (T-453)
 * 4. `LF-AUDIENCE-CONNECTION-LOST` — error — WebSocket reconnect budget exhausted (T-454)
 * 5. `LF-AUDIENCE-ADAPTER-UNAVAILABLE` — error — routing engine could not find a provider (T-425)
 * 6. `LF-AUDIENCE-VENDOR-API-FAILURE` — warn — vendor adapter received non-2xx (T-479..T-483)
 * 7. `LF-AUDIENCE-SNAPSHOT-MISSING` — warn — staticFallback requested missing frame (T-454)
 * 8. `LF-AUDIENCE-CAPACITY-CAP` — warn — openSession refused per tenant cap (T-453)
 */
export const LF_AUDIENCE_SPECS = [
  {
    code: 'LF-AUDIENCE-TENANT-RATE-LIMITED',
    severity: 'warn',
    category: 'other',
    description: 'Per-tenant ingest rate exceeded (ADR-009 §D3); voter sees retry-after backoff.',
  },
  {
    code: 'LF-AUDIENCE-VOTER-RATE-LIMITED',
    severity: 'info',
    category: 'other',
    description: 'Per-voter rate exceeded (ADR-009 §D3); vote dropped silently.',
  },
  {
    code: 'LF-AUDIENCE-SESSION-CLOSED',
    severity: 'info',
    category: 'other',
    description:
      'Voter attempted to submit after the session closed (ADR-009 §D6 close code 4000).',
  },
  {
    code: 'LF-AUDIENCE-CONNECTION-LOST',
    severity: 'error',
    category: 'other',
    description: 'WebSocket reconnect budget exhausted (ADR-009 §D6, 6 retries × max 30 s).',
  },
  {
    code: 'LF-AUDIENCE-ADAPTER-UNAVAILABLE',
    severity: 'error',
    category: 'other',
    description:
      'Routing engine could not find an AudienceBackendProvider for the requested clip-kind / tenant combo.',
  },
  {
    code: 'LF-AUDIENCE-VENDOR-API-FAILURE',
    severity: 'warn',
    category: 'other',
    description: 'Vendor adapter received a non-2xx from the vendor API; retry budget kicked in.',
  },
  {
    code: 'LF-AUDIENCE-SNAPSHOT-MISSING',
    severity: 'warn',
    category: 'other',
    description:
      'staticFallback path requested a snapshotFrame that is not in snapshots/ (corruption signal).',
  },
  {
    code: 'LF-AUDIENCE-CAPACITY-CAP',
    severity: 'warn',
    category: 'other',
    description: 'openSession refused because per-tenant maxConcurrentVotersPerSession is reached.',
  },
] as const satisfies readonly AudienceLossFlagSpec[];

/** Sealed `const` array of the eight `LF-AUDIENCE-*` codes per ADR-009 §D11. */
export const LF_AUDIENCE_CODES = [
  'LF-AUDIENCE-TENANT-RATE-LIMITED',
  'LF-AUDIENCE-VOTER-RATE-LIMITED',
  'LF-AUDIENCE-SESSION-CLOSED',
  'LF-AUDIENCE-CONNECTION-LOST',
  'LF-AUDIENCE-ADAPTER-UNAVAILABLE',
  'LF-AUDIENCE-VENDOR-API-FAILURE',
  'LF-AUDIENCE-SNAPSHOT-MISSING',
  'LF-AUDIENCE-CAPACITY-CAP',
] as const;

/** Union of the eight `LF-AUDIENCE-*` code strings. */
export type LossFlagAudienceCode = (typeof LF_AUDIENCE_CODES)[number];
