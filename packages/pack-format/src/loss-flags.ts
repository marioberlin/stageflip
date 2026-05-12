// packages/pack-format/src/loss-flags.ts
// T-494 — 5 new LF-LICENSE-* / LF-PACK-* loss flag codes per
// ADR-012 §D10. The `@stageflip/loss-flags` package types `code` as
// an open string (per-importer enum); this module defines the
// pack-format-side codes consumers reference.

/**
 * Loss-flag codes the pack-format package emits / its consumers
 * (pack-loader, runtime gate) emit. Per ADR-012 §D10.
 */
export const PACK_FORMAT_LF_CODES = [
  'LF-LICENSE-PACK-DENIED',
  'LF-LICENSE-CLIP-REVOKED',
  'LF-PACK-SIGNATURE-INVALID',
  'LF-PACK-INCOMPATIBLE-VERSION',
  'LF-PACK-MANIFEST-PARSE-ERROR',
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
];
