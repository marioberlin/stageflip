// packages/runtimes/contract/src/index.ts
// @stageflip/runtimes-contract — the shared interface every runtime plugin
// implements. Keeps clip-dispatch logic (renderer-core, Phase 4) decoupled
// from individual runtime implementations (css, gsap, lottie, shader, three,
// blender, frame-runtime-bridge). Zero concrete runtime code lives here.
//
// A runtime declares one or more clips; a clip is identified by a globally
// unique `kind` string. The RIR compiler (Phase 1) emits clip instances
// referencing a kind; the dispatcher (T-083) resolves kind → runtime via
// `findClip(kind)`.
//
// Tiers:
// - 'live'  — runtime renders against the live FrameClock in editor preview
//             and during CDP export. CSS / GSAP / Lottie / shader / three /
//             frame-runtime-bridge.
// - 'bake'  — runtime produces image / video assets offline; export swaps
//             in the baked frames. Blender, heavy three compositions.

import type { ReactElement } from 'react';

/** Rendering tier. `live` runs every frame; `bake` runs once offline. */
export type RuntimeTier = 'live' | 'bake';

/**
 * Render-time context given to every clip's render function. Position +
 * dimensions come from the composition; `clipFrom` + `clipDurationInFrames`
 * let the clip compute its local time if it does not rely on
 * `useCurrentFrame()` (non-React runtimes).
 */
export interface ClipRenderContext<P = unknown> {
  /** Absolute frame in composition time. Non-negative integer. */
  frame: number;
  /** Composition fps. Positive integer. */
  fps: number;
  /** Composition width in CSS pixels. Positive integer. */
  width: number;
  /** Composition height in CSS pixels. Positive integer. */
  height: number;
  /** Clip's `from` frame in composition time. */
  clipFrom: number;
  /** Clip's duration in frames. Non-negative integer; may be `Infinity`. */
  clipDurationInFrames: number;
  /** Clip-specific props. Schema is runtime's concern. */
  props: P;
}

/** Requirement declared by a clip so the FontManager (T-072) can preload it. */
export interface FontRequirement {
  family: string;
  weight?: number | string;
  style?: 'normal' | 'italic' | 'oblique';
}

/**
 * One clip kind within a runtime. `kind` is globally unique across all
 * runtimes; the dispatcher resolves by this string.
 */
export interface ClipDefinition<P = unknown> {
  /** Globally unique kind identifier (e.g. `'motion-text-gsap'`). */
  readonly kind: string;
  /** Render the clip at the provided context. Returns null when clip is inactive. */
  render(ctx: ClipRenderContext<P>): ReactElement | null;
  /** Declare the fonts this clip needs. Optional — defaults to none. */
  fontRequirements?(props: P): FontRequirement[];
}

export interface RuntimePrepareContext {
  /**
   * Placeholder for asset-resolution hooks added in T-084a (asset preflight).
   * Kept open-ended here so later tasks can extend without a contract bump.
   */
  readonly [key: string]: unknown;
}

/**
 * A runtime plugin. Ships with a map of clip kinds it knows how to render,
 * plus optional prepare / dispose lifecycle hooks.
 */
export interface ClipRuntime {
  /** Unique runtime id (e.g. `'css'`, `'gsap'`, `'frame-runtime'`). */
  readonly id: string;
  /** Whether this runtime renders against the live FrameClock or bakes offline. */
  readonly tier: RuntimeTier;
  /** Clip kinds this runtime ships. Keys must equal each definition's `kind`. */
  readonly clips: ReadonlyMap<string, ClipDefinition<unknown>>;
  /** Optional one-shot preparation before the first render (asset loads, etc.). */
  prepare?(ctx: RuntimePrepareContext): Promise<void>;
  /** Optional teardown when the runtime is removed or the app shuts down. */
  dispose?(): void;
}

// ----------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------

const registry = new Map<string, ClipRuntime>();

const TIERS: ReadonlySet<RuntimeTier> = new Set(['live', 'bake']);

/**
 * Register a runtime. Throws on duplicate id, empty id, unknown tier, or
 * any clip whose definition `.kind` does not equal its key in `clips`.
 */
export function registerRuntime(runtime: ClipRuntime): void {
  if (typeof runtime.id !== 'string' || runtime.id.length === 0) {
    throw new Error('registerRuntime: id must be a non-empty string');
  }
  if (!TIERS.has(runtime.tier)) {
    throw new Error(
      `registerRuntime: tier must be 'live' or 'bake' (got ${String(runtime.tier)} on '${runtime.id}')`,
    );
  }
  if (registry.has(runtime.id)) {
    throw new Error(`registerRuntime: id '${runtime.id}' is already registered`);
  }
  for (const [key, def] of runtime.clips) {
    if (key !== def.kind) {
      throw new Error(
        `registerRuntime: clip map key '${key}' does not match definition kind '${def.kind}' in runtime '${runtime.id}'`,
      );
    }
  }
  registry.set(runtime.id, runtime);
}

/** Look up a runtime by id, or `undefined` if not registered. */
export function getRuntime(id: string): ClipRuntime | undefined {
  return registry.get(id);
}

/** Snapshot of every registered runtime, in insertion order. */
export function listRuntimes(): readonly ClipRuntime[] {
  return Array.from(registry.values());
}

/** Remove a runtime. No-op if not present. */
export function unregisterRuntime(id: string): void {
  registry.delete(id);
}

/**
 * Cross-runtime lookup: find the ClipDefinition (and its owning runtime) that
 * declares the given kind. Returns `null` if no runtime claims the kind.
 * When multiple runtimes declare the same kind, the first registered wins —
 * registration order matches iteration order on `Map`.
 */
export function findClip(
  kind: string,
): { runtime: ClipRuntime; clip: ClipDefinition<unknown> } | null {
  for (const runtime of registry.values()) {
    const clip = runtime.clips.get(kind);
    if (clip !== undefined) {
      return { runtime, clip };
    }
  }
  return null;
}

/**
 * Test-only reset of the registry. Double-underscore prefix signals
 * "not application surface" — callers that use this at runtime will corrupt
 * the runtime set.
 */
export function __clearRuntimeRegistry(): void {
  registry.clear();
}
