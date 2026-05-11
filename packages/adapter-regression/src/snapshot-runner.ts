// packages/adapter-regression/src/snapshot-runner.ts
// Pure verification runner (T-435). Given a `RegressableAdapter` (the
// adapter under test) and an `AdapterRegressionSnapshot` (the committed
// expectation), drives the adapter through each `sampleInputs[]` entry
// and reports whether the live output matches.
//
// Pure module — no I/O, no clocks, no random. The CI gate
// (`scripts/check-adapter-regression.ts`) is the only caller that does
// I/O (file reading + dynamic adapter imports).

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { CanonicalInput } from './canonical-input.js';
import {
  type AdapterRegressionSnapshot,
  type SampleInputSnapshot,
  descriptorSha256,
  outputSha256,
} from './snapshot-format.js';

/**
 * The minimal contract the runner needs from an adapter under test. The
 * 9 reference adapters all match this shape — they expose a
 * `descriptor` static + a callable invocation surface (`synthesize` or
 * `generate`) returning `{ cacheKey, ... }`.
 *
 * `invoke(input)` is a uniform wrapper around the modality-specific
 * method (`synthesize` for TTS, `generate` for everything else). The
 * gate adapter (`scripts/check-adapter-regression.ts`) builds these
 * wrappers from the live provider classes.
 */
/**
 * The minimal output shape every adapter's `synthesize` / `generate`
 * promises: a `cacheKey` string + any number of additional fields. The
 * snapshot runner only compares the `cacheKey` directly and hashes the
 * whole object; concrete fields are adapter-specific.
 */
export interface AdapterInvocationResult {
  readonly cacheKey: string;
}

export interface RegressableAdapter {
  readonly id: string;
  readonly descriptor: AdapterDescriptor;
  invoke(input: CanonicalInput): Promise<AdapterInvocationResult>;
}

/**
 * Per-sample drift entry. Names the sample + the field that drifted +
 * both observed values. The CI gate's report formatter renders this.
 */
export interface SampleDrift {
  readonly sampleName: string;
  readonly field: 'cacheKey' | 'outputSha256';
  readonly expected: string;
  readonly actual: string;
}

/**
 * Per-adapter regression verdict.
 *
 * - `'ok'` — every sample's live output matches the recorded snapshot.
 * - `'drift'` — at least one mismatch detected; `descriptorDrift` is
 *   set when the descriptor itself reshaped; `sampleDrifts` lists
 *   per-sample mismatches; `idMismatch` / `modalityMismatch` cover the
 *   higher-order corruption cases.
 */
export type AdapterRegressionVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly idMismatch?: { readonly expected: string; readonly actual: string };
      readonly modalityMismatch?: { readonly expected: string; readonly actual: string };
      readonly descriptorDrift?: { readonly expected: string; readonly actual: string };
      readonly sampleDrifts: ReadonlyArray<SampleDrift>;
    };

/**
 * Verify `adapter` against `snapshot`. Pure — performs only async hash
 * computations + the adapter's own `invoke()` (which the caller wired).
 */
export async function runAdapterAgainstSnapshot(
  adapter: RegressableAdapter,
  snapshot: AdapterRegressionSnapshot,
): Promise<AdapterRegressionVerdict> {
  // Higher-order identity checks first.
  const idMismatch =
    adapter.id === snapshot.id
      ? undefined
      : { expected: snapshot.id, actual: adapter.id };
  const liveModality = adapter.descriptor.modality.kind;
  const modalityMismatch =
    liveModality === snapshot.modality
      ? undefined
      : { expected: snapshot.modality, actual: liveModality };

  // Descriptor hash.
  const liveDescriptorHash = await descriptorSha256(adapter.descriptor);
  const descriptorDrift =
    liveDescriptorHash === snapshot.descriptorSha256
      ? undefined
      : { expected: snapshot.descriptorSha256, actual: liveDescriptorHash };

  // Per-sample replay.
  const sampleDrifts: SampleDrift[] = [];
  for (const sample of snapshot.sampleInputs) {
    const drifts = await checkSample(adapter, sample);
    sampleDrifts.push(...drifts);
  }

  if (
    idMismatch === undefined &&
    modalityMismatch === undefined &&
    descriptorDrift === undefined &&
    sampleDrifts.length === 0
  ) {
    return { ok: true };
  }
  const verdict: {
    ok: false;
    idMismatch?: { expected: string; actual: string };
    modalityMismatch?: { expected: string; actual: string };
    descriptorDrift?: { expected: string; actual: string };
    sampleDrifts: ReadonlyArray<SampleDrift>;
  } = { ok: false, sampleDrifts };
  if (idMismatch !== undefined) verdict.idMismatch = idMismatch;
  if (modalityMismatch !== undefined) verdict.modalityMismatch = modalityMismatch;
  if (descriptorDrift !== undefined) verdict.descriptorDrift = descriptorDrift;
  return verdict;
}

async function checkSample(
  adapter: RegressableAdapter,
  sample: SampleInputSnapshot,
): Promise<ReadonlyArray<SampleDrift>> {
  let result: AdapterInvocationResult;
  try {
    result = await adapter.invoke(sample.input);
  } catch (err) {
    // Treat invocation failure as a `outputSha256` drift — the snapshot
    // captures successful outputs; if the live adapter now throws, the
    // snapshot is stale.
    return [
      {
        sampleName: sample.name,
        field: 'outputSha256',
        expected: sample.outputSha256,
        actual: `THREW: ${err instanceof Error ? err.message : String(err)}`,
      },
    ];
  }

  const drifts: SampleDrift[] = [];
  if (result.cacheKey !== sample.cacheKey) {
    drifts.push({
      sampleName: sample.name,
      field: 'cacheKey',
      expected: sample.cacheKey,
      actual: result.cacheKey,
    });
  }
  const liveOutputHash = await outputSha256(result);
  if (liveOutputHash !== sample.outputSha256) {
    drifts.push({
      sampleName: sample.name,
      field: 'outputSha256',
      expected: sample.outputSha256,
      actual: liveOutputHash,
    });
  }
  return drifts;
}

/**
 * Format a verdict as a human-legible string. Used by the CI gate's
 * `formatReport` helper.
 */
export function formatVerdict(adapterId: string, verdict: AdapterRegressionVerdict): string {
  if (verdict.ok) return `  ${adapterId}  ->  OK`;
  const lines: string[] = [`  ${adapterId}  ->  DRIFT`];
  if (verdict.idMismatch !== undefined) {
    lines.push(
      `    id-mismatch: expected="${verdict.idMismatch.expected}" actual="${verdict.idMismatch.actual}"`,
    );
  }
  if (verdict.modalityMismatch !== undefined) {
    lines.push(
      `    modality-mismatch: expected="${verdict.modalityMismatch.expected}" actual="${verdict.modalityMismatch.actual}"`,
    );
  }
  if (verdict.descriptorDrift !== undefined) {
    lines.push(
      `    descriptor-drift: expected=${verdict.descriptorDrift.expected} actual=${verdict.descriptorDrift.actual}`,
    );
  }
  for (const d of verdict.sampleDrifts) {
    lines.push(
      `    sample "${d.sampleName}" [${d.field}]: expected=${d.expected} actual=${d.actual}`,
    );
  }
  return lines.join('\n');
}
