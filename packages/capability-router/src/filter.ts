// packages/capability-router/src/filter.ts
// 3-stage filter pipeline for the capability-routing engine.
//
// Stages in order:
//   1. Modality match — descriptor.modality.kind === input.modality
//   2. Capability match — caller-supplied predicate (default: pass-through)
//   3. License + sandbox — LicenseGate decision + hostSandboxKinds membership
//
// An adapter rejected at stage N is NOT re-considered at stages N+1..K.
// The pipeline returns the passed-through set + a per-reason rejection tally
// using first-failure attribution.
//
// BROWSER-SAFE: pure function; no I/O; no Node-only imports.

import type { AdapterDescriptor, LicenseGate, SandboxKind } from '@stageflip/adapters-core';
import { defaultLicenseGate } from '@stageflip/adapters-core';

import {
  type CapabilityPredicate,
  type FilteredByReason,
  type RejectionReason,
  REJECTION_REASONS,
  type RoutingInput,
} from './types.js';

/**
 * Options the filter pipeline consumes. Subset of `RoutingInput` —
 * exposed for callers that want the filter step without ranking.
 */
export interface FilterPipelineOptions {
  readonly modality: RoutingInput['modality'];
  readonly tenant: RoutingInput['tenant'];
  readonly capabilityPredicate?: CapabilityPredicate;
  readonly hostSandboxKinds?: ReadonlySet<SandboxKind>;
  readonly licenseGate?: LicenseGate;
}

/**
 * Result of running the 3-stage filter pipeline against an adapter list.
 */
export interface FilterPipelineResult {
  readonly passed: readonly AdapterDescriptor[];
  readonly filteredByReason: FilteredByReason;
}

/**
 * Build a dense zero-init tally over every `RejectionReason`. The tally is
 * mutable internally and frozen at the boundary — `FilteredByReason` is the
 * `Readonly<...>` view returned to callers.
 */
function zeroTally(): Record<RejectionReason, number> {
  const out: Record<RejectionReason, number> = {
    'modality-mismatch': 0,
    'capability-mismatch': 0,
    'license-denied': 0,
    'credential-missing': 0,
    'sandbox-unavailable': 0,
  };
  // Sanity: the literal must enumerate every REJECTION_REASONS entry.
  // Iterating is cheap and catches future drift.
  for (const reason of REJECTION_REASONS) {
    // biome-ignore lint/suspicious/noPrototypeBuiltins: explicit dense-key check
    if (!Object.prototype.hasOwnProperty.call(out, reason)) {
      throw new Error(`capability-router: REJECTION_REASONS drift — missing key '${reason}'`);
    }
  }
  return out;
}

/**
 * Build a pipeline closure suitable for repeated invocation. Each invocation
 * re-runs the 3 stages against a fresh adapter list — the pipeline itself
 * holds no per-call state.
 *
 * Exposed for callers that want to compose filtering separately from
 * ranking (e.g., a debug UI inspecting per-stage drop-off).
 */
export function buildFilterPipeline(
  opts: FilterPipelineOptions,
): (adapters: readonly AdapterDescriptor[]) => FilterPipelineResult {
  const gate = opts.licenseGate ?? defaultLicenseGate;
  const sandboxAllowed = opts.hostSandboxKinds;
  const predicate = opts.capabilityPredicate;

  return (adapters) => {
    const tally = zeroTally();
    const passed: AdapterDescriptor[] = [];

    for (const adapter of adapters) {
      // Stage 1: modality match
      if (adapter.modality.kind !== opts.modality) {
        tally['modality-mismatch'] += 1;
        continue;
      }

      // Stage 2: capability match
      if (predicate !== undefined && !predicate(adapter.capability, adapter)) {
        tally['capability-mismatch'] += 1;
        continue;
      }

      // Stage 3a: license-gate decision
      const decision = gate.evaluate(adapter, opts.tenant);
      if (decision === 'deny') {
        tally['license-denied'] += 1;
        continue;
      }
      if (decision === 'requires-consent') {
        tally['credential-missing'] += 1;
        continue;
      }

      // Stage 3b: sandbox availability (only applied when the host
      // declared a kinds set; absence = no filtering, default in dev).
      if (sandboxAllowed !== undefined && !sandboxAllowed.has(adapter.sandbox.kind)) {
        tally['sandbox-unavailable'] += 1;
        continue;
      }

      passed.push(adapter);
    }

    return {
      passed,
      filteredByReason: Object.freeze({ ...tally }),
    };
  };
}
