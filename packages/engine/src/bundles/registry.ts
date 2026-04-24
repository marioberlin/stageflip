// packages/engine/src/bundles/registry.ts
// BundleRegistry — stateless lookup over the bundle catalog. Backs the
// `list_bundles` (via `list()`) and `expand_scope` (via `get()`) meta-tools
// from skills/stageflip/concepts/tool-bundles. The stateful concern —
// "which bundles are loaded into THIS Executor step's context" — lives in
// BundleLoader; see loader.ts.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { CANONICAL_BUNDLES } from './catalog.js';
import { type BundleSummary, type ToolBundle, summarise } from './types.js';

export class BundleRegistry {
  private readonly bundles = new Map<string, ToolBundle>();

  /**
   * Register a bundle. A second call with the same name overwrites — T-155+
   * handler packages use this to "fill in" canonical bundles whose catalog
   * entry shipped with empty tools.
   */
  register(bundle: ToolBundle): void {
    this.bundles.set(bundle.name, bundle);
  }

  /** Append tools to a registered bundle, preserving existing ones. */
  mergeTools(name: string, tools: readonly LLMToolDefinition[]): void {
    const existing = this.bundles.get(name);
    if (!existing) {
      throw new Error(`BundleRegistry.mergeTools: unknown bundle "${name}"`);
    }
    this.bundles.set(name, {
      ...existing,
      tools: [...existing.tools, ...tools],
    });
  }

  /** `list_bundles` — summaries only (I-9 budget: summaries are cheap). */
  list(): BundleSummary[] {
    return [...this.bundles.values()].map(summarise);
  }

  /** `expand_scope` — full bundle with its tool definitions. */
  get(name: string): ToolBundle | undefined {
    return this.bundles.get(name);
  }

  has(name: string): boolean {
    return this.bundles.has(name);
  }

  get size(): number {
    return this.bundles.size;
  }
}

/**
 * Build a registry seeded with the 14 canonical bundles. Each call returns
 * an independent registry so tests can mutate without leaking state.
 */
export function createCanonicalRegistry(): BundleRegistry {
  const registry = new BundleRegistry();
  for (const bundle of CANONICAL_BUNDLES) registry.register(bundle);
  return registry;
}
