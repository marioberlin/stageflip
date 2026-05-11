// packages/adapters-core/src/capability-parser.ts
// `CapabilityDescriptorParser` — pluggable per-modality validator dispatch.
//
// Per ADR-007 §D1's "Why `capability` is opaque" rationale, adapters-core
// cannot validate per-modality shapes; that surface is the consumer ADR's
// freedom (asset-gen → ADR-008 / T-419, audience → ADR-009 / T-452, etc.).
// T-418 ships ONLY the dispatch shell. Per-modality validators are
// constructor-injected by downstream packages.
//
// Outcomes:
//  - `ok: true`  — validator accepted the capability
//  - `ok: 'unvalidated'` — no validator registered for the modality kind;
//                  capability is passed through verbatim. Routing engine
//                  may or may not surface this as a warning (T-425's call).
//  - `ok: false` — validator rejected; error surfaces verbatim.

import type {
  AdapterDescriptor,
  AdapterModalityKind,
  CapabilityDescriptor,
} from './adapter-descriptor.js';

/**
 * Result returned by a per-modality capability validator. Validators are
 * supplied by downstream consumer packages (T-419 ships the first ones).
 */
export type CapabilityValidationResult =
  | { readonly ok: true; readonly capability: CapabilityDescriptor }
  | { readonly ok: false; readonly error: string };

/**
 * Per-modality validator function. Receives the opaque capability envelope
 * and returns a validation result. Validators MUST be pure — no I/O — so
 * `parse()` remains deterministic.
 */
export type CapabilityValidator = (capability: unknown) => CapabilityValidationResult;

/**
 * Result returned by `CapabilityDescriptorParser.parse(...)`.
 *
 * The `'unvalidated'` outcome is intentionally distinct from `true` — it
 * communicates to the caller that the capability passed through without
 * any validator binding to vouch for its shape. T-419's first registration
 * promotes the relevant modality from `'unvalidated'` to `true`/`false`.
 */
export type ParseResult =
  | { readonly ok: true; readonly capability: CapabilityDescriptor }
  | { readonly ok: 'unvalidated'; readonly capability: CapabilityDescriptor }
  | { readonly ok: false; readonly error: string };

/**
 * Pluggable capability-descriptor parser. Constructor takes a map of
 * per-modality validators; `parse()` dispatches by `descriptor.modality.kind`.
 *
 * Use one parser instance per registry (or share one across registries when
 * the validator set is uniform — typical case). The parser is stateless
 * past construction; calls are thread-safe.
 */
export class CapabilityDescriptorParser {
  readonly #validators: ReadonlyMap<AdapterModalityKind, CapabilityValidator>;

  constructor(validators?: ReadonlyMap<AdapterModalityKind, CapabilityValidator>) {
    this.#validators = validators ?? new Map();
  }

  /**
   * Validate a descriptor's capability against the registered validator for
   * its modality. Returns `'unvalidated'` when no validator is registered.
   */
  parse(descriptor: AdapterDescriptor): ParseResult {
    const validator = this.#validators.get(descriptor.modality.kind);
    if (validator === undefined) {
      return { ok: 'unvalidated', capability: descriptor.capability };
    }
    const result = validator(descriptor.capability);
    if (result.ok) {
      return { ok: true, capability: result.capability };
    }
    return { ok: false, error: result.error };
  }

  /** Modality kinds for which a validator is currently registered. */
  registeredModalities(): readonly AdapterModalityKind[] {
    return Array.from(this.#validators.keys());
  }
}

/**
 * Helper: build a validator map from a plain object literal — convenience
 * for downstream packages that want to declare validators inline.
 */
export function buildValidatorMap(
  entries: Partial<Record<AdapterModalityKind, CapabilityValidator>>,
): ReadonlyMap<AdapterModalityKind, CapabilityValidator> {
  const map = new Map<AdapterModalityKind, CapabilityValidator>();
  for (const [kind, validator] of Object.entries(entries)) {
    if (validator !== undefined) {
      map.set(kind as AdapterModalityKind, validator);
    }
  }
  return map;
}
