// packages/adapters-core/src/registry.ts
// `AdapterRegistry` — in-memory map of adapters keyed by
// `(modality.kind, id)`. The capability-routing engine (T-425) reads from
// this; reference adapters (T-426..T-434) write into it; the host shell
// owns instance lifetime.
//
// The registry is `class`-based (not module-singleton like
// `packages/runtimes/contract`) because adapters-core supports multi-tenant
// dispatch — a server worker may host one registry per tenant, isolated
// from other tenants. The runtimes contract is a single global because
// every consumer ships the same runtime set; adapters are tenant-policy-
// shaped and can vary.

import type { AdapterDescriptor, AdapterModalityKind } from './adapter-descriptor.js';

/**
 * Key shape: `${modality.kind}::${id}`. The pair is the registry's primary
 * key; the same `id` MAY appear under different modality kinds.
 */
function keyOf(modalityKind: AdapterModalityKind, id: string): string {
  return `${modalityKind}::${id}`;
}

/**
 * In-memory adapter registry. Per-tenant; instantiate one per isolation
 * boundary. Entries are inserted in registration order (Map preserves it);
 * `list()` returns iteration order; `byCapability()` filters insertion-
 * order results.
 */
export class AdapterRegistry {
  readonly #adapters = new Map<string, AdapterDescriptor>();

  /**
   * Register an adapter. Throws on duplicate `(modality.kind, id)`.
   * The descriptor is stored by reference — the caller MUST treat it as
   * immutable; mutating the object after registration corrupts the
   * registry's read view.
   */
  register(adapter: AdapterDescriptor): void {
    const key = keyOf(adapter.modality.kind, adapter.id);
    if (this.#adapters.has(key)) {
      throw new Error(
        `AdapterRegistry.register: adapter '${adapter.id}' is already registered for modality '${adapter.modality.kind}'`,
      );
    }
    this.#adapters.set(key, adapter);
  }

  /**
   * Unregister an adapter. Idempotent — returns `true` if an entry was
   * removed, `false` if no entry existed.
   */
  unregister(modalityKind: AdapterModalityKind, id: string): boolean {
    return this.#adapters.delete(keyOf(modalityKind, id));
  }

  /**
   * Look up an adapter by `(modality.kind, id)`. Returns `undefined` if
   * not registered.
   */
  lookup(modalityKind: AdapterModalityKind, id: string): AdapterDescriptor | undefined {
    return this.#adapters.get(keyOf(modalityKind, id));
  }

  /**
   * Snapshot of registered adapters. When `modalityKind` is supplied,
   * filters to that modality; otherwise returns every adapter. Returned
   * in insertion order.
   */
  list(modalityKind?: AdapterModalityKind): readonly AdapterDescriptor[] {
    if (modalityKind === undefined) {
      return Array.from(this.#adapters.values());
    }
    const out: AdapterDescriptor[] = [];
    for (const adapter of this.#adapters.values()) {
      if (adapter.modality.kind === modalityKind) out.push(adapter);
    }
    return out;
  }

  /**
   * Filter adapters for a modality by a caller-supplied predicate over the
   * opaque `capability` envelope. Use when downstream needs to pick by
   * modality-specific capability shape (e.g., TTS adapters supporting a
   * given sample rate).
   *
   * Returned in insertion order.
   */
  byCapability(
    modalityKind: AdapterModalityKind,
    predicate: (capability: AdapterDescriptor['capability'], adapter: AdapterDescriptor) => boolean,
  ): readonly AdapterDescriptor[] {
    const out: AdapterDescriptor[] = [];
    for (const adapter of this.#adapters.values()) {
      if (adapter.modality.kind !== modalityKind) continue;
      if (predicate(adapter.capability, adapter)) out.push(adapter);
    }
    return out;
  }

  /** Number of registered adapters. */
  get size(): number {
    return this.#adapters.size;
  }

  /**
   * Drop every registered adapter. Test-only / hot-reload escape hatch;
   * production shells should construct a fresh registry rather than
   * clearing one in flight.
   */
  clear(): void {
    this.#adapters.clear();
  }
}
