// packages/engine/src/bundles/loader.ts
// BundleLoader — stateful per-Executor-step tool context. Backs the
// `load_bundle(name)` meta-tool. Enforces invariant I-9: the set of loaded
// tools in any single agent context MUST NOT exceed `maxTools` (default
// 30). Crossing the limit raises `BundleLoadError` with a named kind so
// the Planner can split the offending step and retry.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import type { BundleRegistry } from './registry.js';
import type { ToolBundle } from './types.js';

/** Invariant I-9 default budget. Raise only with an explicit ADR. */
export const DEFAULT_TOOL_LIMIT = 30;

export type BundleLoadErrorKind = 'unknown_bundle' | 'limit_exceeded' | 'already_loaded';

export class BundleLoadError extends Error {
  readonly kind: BundleLoadErrorKind;
  readonly bundleName: string;
  /** Size the load would have produced. Populated for `limit_exceeded`. */
  readonly requestedSize: number | undefined;
  /** Configured cap. Populated for `limit_exceeded`. */
  readonly limit: number | undefined;

  constructor(
    kind: BundleLoadErrorKind,
    bundleName: string,
    message: string,
    context: { requestedSize?: number; limit?: number } = {},
  ) {
    super(message);
    this.name = 'BundleLoadError';
    this.kind = kind;
    this.bundleName = bundleName;
    this.requestedSize = context.requestedSize;
    this.limit = context.limit;
  }
}

export interface BundleLoaderOptions {
  /** Defaults to {@link DEFAULT_TOOL_LIMIT}. */
  maxTools?: number;
}

export class BundleLoader {
  readonly maxTools: number;
  private readonly registry: BundleRegistry;
  private readonly loadedBundles = new Map<string, ToolBundle>();

  constructor(registry: BundleRegistry, options: BundleLoaderOptions = {}) {
    this.registry = registry;
    this.maxTools = options.maxTools ?? DEFAULT_TOOL_LIMIT;
  }

  /**
   * Load a bundle into the current context. Refuses when the load would
   * push the combined tool count past `maxTools`; refuses when the bundle
   * is already loaded (callers should branch on the error `kind`, not
   * re-call load on an already-loaded bundle).
   */
  load(name: string): ToolBundle {
    const bundle = this.registry.get(name);
    if (!bundle) {
      throw new BundleLoadError('unknown_bundle', name, `Unknown bundle "${name}"`);
    }
    if (this.loadedBundles.has(name)) {
      throw new BundleLoadError(
        'already_loaded',
        name,
        `Bundle "${name}" is already loaded in this context`,
      );
    }
    const nextSize = this.toolCount() + bundle.tools.length;
    if (nextSize > this.maxTools) {
      throw new BundleLoadError(
        'limit_exceeded',
        name,
        `Loading "${name}" would exceed the ${this.maxTools}-tool invariant (would become ${nextSize})`,
        { requestedSize: nextSize, limit: this.maxTools },
      );
    }
    this.loadedBundles.set(name, bundle);
    return bundle;
  }

  /** Drop all currently-loaded bundles — call between Executor steps. */
  reset(): void {
    this.loadedBundles.clear();
  }

  /** Immutable snapshot of currently-loaded bundles. */
  loaded(): ToolBundle[] {
    return [...this.loadedBundles.values()];
  }

  /** Flat list of tool definitions — what the Executor passes to the LLM. */
  toolDefinitions(): LLMToolDefinition[] {
    const out: LLMToolDefinition[] = [];
    for (const bundle of this.loadedBundles.values()) {
      for (const tool of bundle.tools) out.push(tool);
    }
    return out;
  }

  toolCount(): number {
    let total = 0;
    for (const bundle of this.loadedBundles.values()) {
      total += bundle.tools.length;
    }
    return total;
  }
}
