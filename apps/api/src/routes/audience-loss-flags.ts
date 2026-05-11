// apps/api/src/routes/audience-loss-flags.ts
// T-453 — Thin emitter wrapping `@stageflip/loss-flags`' `emitLossFlag`
// for the seven server-side `LF-AUDIENCE-*` codes per ADR-009 §D11.
// The eighth code (`LF-AUDIENCE-CONNECTION-LOST`) is client-side per
// ADR-009 §D11 and is emitted by the audience runtime (T-454), not
// this module.
//
// Codes routed here:
//   - LF-AUDIENCE-TENANT-RATE-LIMITED       (warn — tenant cap exceeded)
//   - LF-AUDIENCE-VOTER-RATE-LIMITED        (info — voter cap exceeded)
//   - LF-AUDIENCE-SESSION-CLOSED            (info — vote after close)
//   - LF-AUDIENCE-CAPACITY-CAP              (warn — voter-cap reached)
//   - LF-AUDIENCE-ADAPTER-UNAVAILABLE       (error — no provider found)
//   - LF-AUDIENCE-VENDOR-API-FAILURE        (warn — vendor non-2xx)
//   - LF-AUDIENCE-SNAPSHOT-MISSING          (warn — staticFallback frame absent)
//
// Severity/category defaults come from `LF_AUDIENCE_SPECS` in
// `@stageflip/audience-contract`; callers supply only the code, location
// metadata, and message. `LossFlag.source` is `'audience-backend'`.

import {
  type AudienceLossFlagSpec,
  LF_AUDIENCE_SPECS,
  type LossFlagAudienceCode,
} from '@stageflip/audience-contract';
import { type LossFlag, emitLossFlag } from '@stageflip/loss-flags';

/**
 * Server-side subset of `LossFlagAudienceCode` — excludes the
 * client-only `LF-AUDIENCE-CONNECTION-LOST` per ADR-009 §D11. Used at
 * every emission site so the type system catches "did you mean to emit
 * the client-side code?" mistakes.
 */
export type ServerAudienceLossFlagCode = Exclude<
  LossFlagAudienceCode,
  'LF-AUDIENCE-CONNECTION-LOST'
>;

export interface AudienceLossFlagInput {
  readonly code: ServerAudienceLossFlagCode;
  readonly message: string;
  readonly location: LossFlag['location'];
  readonly recovery?: string;
}

/**
 * Look up the spec for a given audience code. Throws if the code is not
 * in the sealed inventory — guards against accidental drift between the
 * contract package and emission sites.
 */
function specFor(code: ServerAudienceLossFlagCode): AudienceLossFlagSpec {
  const spec = LF_AUDIENCE_SPECS.find((s) => s.code === code);
  if (!spec) {
    throw new Error(`audience-loss-flags: unknown code "${code}" (not in LF_AUDIENCE_SPECS)`);
  }
  return spec;
}

/**
 * Emit a server-side audience loss flag. Resolves severity + category
 * from the contract-side spec, stamps `source: 'audience-backend'`, and
 * delegates to the generic `emitLossFlag` for the deterministic id.
 *
 * Returns the emitted `LossFlag` so callers can route it to the
 * appropriate sink (presenter WS, voter WS error frame, structured
 * server log, etc.). The function itself is pure — no I/O.
 */
export function emitAudienceLossFlag(input: AudienceLossFlagInput): LossFlag {
  const spec = specFor(input.code);
  return emitLossFlag({
    source: 'audience-backend',
    code: input.code,
    severity: spec.severity,
    category: spec.category,
    message: input.message,
    location: input.location,
    ...(input.recovery !== undefined ? { recovery: input.recovery } : {}),
  });
}
