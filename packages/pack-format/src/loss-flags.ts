// packages/pack-format/src/loss-flags.ts
// T-494 — 5 LF-LICENSE-* / LF-PACK-* loss flag codes per ADR-012 §D10.
// T-505 — Extended with 2 trial-mode codes (LF-LICENSE-TRIAL-ACTIVE,
// LF-LICENSE-TRIAL-EXPIRED).
// T-539 — Extended with 1 npm-path code (LF-NPM-TOKEN-MISSING) per
// ADR-014 §D2 / §D4 (npm-based distribution fallback path requires
// a tenant-scoped npm token before the license-claim verifier admits
// a paid pack). The `@stageflip/loss-flags` package types `code` as
// an open string (per-importer enum); this module defines the
// pack-format-side codes consumers reference.

/**
 * Loss-flag codes the pack-format package emits / its consumers
 * (pack-loader, runtime gate, pack-trial policy, marketplace-npm
 * verifier) emit. Per ADR-012 §D10 + T-505 trial extension +
 * T-539 npm-path extension.
 */
export const PACK_FORMAT_LF_CODES = [
  'LF-LICENSE-PACK-DENIED',
  'LF-LICENSE-CLIP-REVOKED',
  'LF-PACK-SIGNATURE-INVALID',
  'LF-PACK-INCOMPATIBLE-VERSION',
  'LF-PACK-MANIFEST-PARSE-ERROR',
  'LF-LICENSE-TRIAL-ACTIVE',
  'LF-LICENSE-TRIAL-EXPIRED',
  'LF-NPM-TOKEN-MISSING',
] as const;
export type PackFormatLossFlagCode = (typeof PACK_FORMAT_LF_CODES)[number];

/**
 * Per-code severity + trigger documentation. Mirrors the per-code spec
 * tables in `@stageflip/audience-contract`'s loss-flags module (T-452).
 */
export interface PackFormatLossFlagSpec {
  readonly code: PackFormatLossFlagCode;
  readonly severity: 'info' | 'warn' | 'error';
  readonly trigger: string;
}

export const PACK_FORMAT_LF_SPECS: readonly PackFormatLossFlagSpec[] = [
  {
    code: 'LF-LICENSE-PACK-DENIED',
    severity: 'error',
    trigger: 'Install-time entitlement check failed for a paid-per-tenant / enterprise pack',
  },
  {
    code: 'LF-LICENSE-CLIP-REVOKED',
    severity: 'warn',
    trigger:
      'Mid-session entitlement revocation — clip falls back to staticFallback per ADR-012 §D6',
  },
  {
    code: 'LF-PACK-SIGNATURE-INVALID',
    severity: 'error',
    trigger: 'Ed25519 verification of pack signature failed (key mismatch or tampered archive)',
  },
  {
    code: 'LF-PACK-INCOMPATIBLE-VERSION',
    severity: 'error',
    trigger: "Pack's platformCompatibility range does not match host StageFlip version",
  },
  {
    code: 'LF-PACK-MANIFEST-PARSE-ERROR',
    severity: 'error',
    trigger: 'manifest.json rejected by packManifestSchema at parse time',
  },
  {
    code: 'LF-LICENSE-TRIAL-ACTIVE',
    severity: 'warn',
    trigger:
      'Pack with trial entitlement mounted a clip; output is watermarked (T-505 trial-mode policy)',
  },
  {
    code: 'LF-LICENSE-TRIAL-EXPIRED',
    severity: 'error',
    trigger:
      'Pack with trial entitlement attempted to mount a clip after expiresAt; runtime denies (T-505)',
  },
  {
    code: 'LF-NPM-TOKEN-MISSING',
    severity: 'error',
    trigger:
      'npm-based install path could not find a tenant-scoped npm auth token for the publisher scope of a paid / enterprise pack (ADR-014 §D2 + T-539)',
  },
];
