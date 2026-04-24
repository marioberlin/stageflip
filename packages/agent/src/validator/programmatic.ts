// packages/agent/src/validator/programmatic.ts
// Built-in programmatic checks. T-153 ships `schema_round_trip`; the
// fuller pre-render lint (T-104) + parity PSNR/SSIM (T-100) are
// registered via the caller's `extraProgrammaticChecks` — they are
// document-shape-agnostic dependencies and don't belong baked into
// the Validator.

import { type Document, documentSchema } from '@stageflip/schema';
import type { ProgrammaticCheck, ProgrammaticCheckResult } from './types.js';

/**
 * `documentSchema.parse(document)` must succeed, and re-serialising +
 * re-parsing must round-trip byte-for-byte when we compare JSON strings.
 * Catches Executor-side patches that land a shape the schema rejects.
 */
export const schemaRoundTripCheck: ProgrammaticCheck = {
  name: 'schema_round_trip',
  run(document): ProgrammaticCheckResult {
    const firstParse = documentSchema.safeParse(document);
    if (!firstParse.success) {
      return {
        name: 'schema_round_trip',
        status: 'fail',
        detail: `documentSchema.parse failed: ${firstParse.error.message}`,
      };
    }

    const serialized = JSON.stringify(firstParse.data);
    let reparsed: Document;
    try {
      reparsed = documentSchema.parse(JSON.parse(serialized));
    } catch (error) {
      return {
        name: 'schema_round_trip',
        status: 'fail',
        detail: `Reparse failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (JSON.stringify(reparsed) !== serialized) {
      return {
        name: 'schema_round_trip',
        status: 'fail',
        detail: 'Round-trip produced a non-identical document',
      };
    }

    return { name: 'schema_round_trip', status: 'pass' };
  },
};

export const DEFAULT_PROGRAMMATIC_CHECKS: readonly ProgrammaticCheck[] = [schemaRoundTripCheck];

export async function runProgrammaticChecks(
  document: Document,
  checks: readonly ProgrammaticCheck[],
): Promise<ProgrammaticCheckResult[]> {
  const out: ProgrammaticCheckResult[] = [];
  for (const check of checks) {
    try {
      out.push(await check.run(document));
    } catch (error) {
      out.push({
        name: check.name,
        status: 'fail',
        detail: `Check threw: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return out;
}
