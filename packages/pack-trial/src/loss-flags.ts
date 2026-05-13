// packages/pack-trial/src/loss-flags.ts
// T-505 — Loss-flag emission helpers for trial-mode pack activations.
// The two LF codes themselves are catalogued in `@stageflip/pack-format`
// (alongside the existing 5 LF-LICENSE-* / LF-PACK-* codes); this
// module provides the typed-record factories the engine + renderer
// integrations call to build flag payloads.

import type { PackFormatLossFlagCode } from '@stageflip/pack-format';

/**
 * Trial-mode loss flag record. Discriminated by `code`; severity
 * mirrors the catalogue entry in `@stageflip/pack-format`.
 */
export interface TrialLossFlag {
  readonly code: PackFormatLossFlagCode;
  readonly severity: 'warn' | 'error';
  readonly packId: string;
  readonly detail: string;
}

/**
 * Build the `LF-LICENSE-TRIAL-ACTIVE` (warning) flag for a pack
 * currently running on a trial entitlement. Emitted at clip-mount
 * time alongside `ok: true` so the host can surface the trial badge
 * + watermark to the user.
 */
export function trialActiveLossFlag(packId: string): TrialLossFlag {
  return {
    code: 'LF-LICENSE-TRIAL-ACTIVE',
    severity: 'warn',
    packId,
    detail: `pack '${packId}' is running in trial mode; output is watermarked`,
  };
}

/**
 * Build the `LF-LICENSE-TRIAL-EXPIRED` (error) flag for a pack whose
 * trial entitlement has expired. Emitted by the engine clip-mount gate
 * after the install-time gate has already let the pack through (the
 * install gate uses `LF-LICENSE-PACK-DENIED` for the same condition;
 * the runtime LF here is the user-visible "your trial just expired"
 * signal).
 */
export function trialExpiredLossFlag(packId: string, expiresAt: string): TrialLossFlag {
  return {
    code: 'LF-LICENSE-TRIAL-EXPIRED',
    severity: 'error',
    packId,
    detail: `pack '${packId}' trial expired at ${expiresAt}`,
  };
}
