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

import type { Theme, ThemePalette } from '@stageflip/schema';
import type { ReactElement } from 'react';
import type { ZodType } from 'zod';

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

/** Requirement declared by a clip so the FontManager can preload it. */
export interface FontRequirement {
  family: string;
  /** CSS weight — numeric (e.g. 400, 600) or keyword ('bold', 'variable'). */
  weight?: number | string;
  /** CSS font-style. */
  style?: 'normal' | 'italic' | 'oblique';
  /** Unicode subsets (matches `@fontsource` subsets: `'latin'`, `'cyrillic'`, ...). */
  subsets?: readonly string[];
  /** OpenType features to enable (e.g. `'ss01'`, `'tnum'`). */
  features?: readonly string[];
}

/**
 * One end of a themeable prop binding. A clip declares — via
 * `ClipDefinition.themeSlots` — which of its props pull defaults from the
 * document theme. Two flavors:
 *  - `palette` references a named role on `Theme.palette` (`primary`,
 *    `accent`, …). Lets document-level theme swaps re-propagate.
 *  - `token` references a dotted path on `Theme.tokens` (e.g.
 *    `'color.brand.lime'`). Lets richer learned themes (T-249) drive any
 *    clip prop without expanding the named-palette surface.
 *
 * Hardcoded palette literals in a clip body miss theme swaps; declared
 * slots survive them. See `resolveClipDefaultsForTheme`.
 */
export type ThemeSlot =
  | { readonly kind: 'palette'; readonly role: keyof ThemePalette }
  | { readonly kind: 'token'; readonly path: string };

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
  /**
   * Optional Zod schema describing the clip's props. Consumed by the editor
   * auto-inspector (T-125b `<ZodForm>`) and, later, by agent tool plumbing
   * (Phase 7). When absent, the inspector falls back to a read-only notice
   * explaining that the clip does not expose a schema. A runtime may ship
   * some clips with schemas and others without — the field is independent
   * per clip.
   */
  readonly propsSchema?: ZodType<P>;
  /**
   * Optional map: clip prop name → theme slot. `resolveClipDefaultsForTheme`
   * fills any prop whose value is `undefined` with the theme's value for
   * that slot. An explicit prop value always wins. The map is keyed loosely
   * (`Record<string, ThemeSlot>`) because the registry erases `P` — type
   * safety on prop names is the author's responsibility at definition site.
   */
  readonly themeSlots?: Readonly<Record<string, ThemeSlot>>;
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

// ----------------------------------------------------------------------------
// Theme resolution
// ----------------------------------------------------------------------------

/**
 * Apply the document theme to a clip's props by filling any prop whose value
 * is `undefined` with the theme's value for that prop's declared slot. An
 * explicit (non-undefined) prop value always wins; a slot whose theme lookup
 * returns `undefined` leaves the prop undefined. Returns a new object — the
 * input is never mutated.
 *
 * Clips without `themeSlots` get the input back by reference (fast path).
 * Clips with a present-but-empty `themeSlots: {}` map still get a fresh
 * object — the identity return is reserved for the declaration-absent case.
 *
 * Use at the boundary between the document layer (which holds the theme) and
 * the renderer (which dispatches per-clip props). The renderer-core
 * dispatcher will call this once per clip render.
 */
export function resolveClipDefaultsForTheme<P extends Record<string, unknown>>(
  clip: ClipDefinition<P>,
  theme: Theme,
  props: P,
): P {
  const slots = clip.themeSlots;
  if (slots === undefined) return props;
  const out: Record<string, unknown> = { ...props };
  for (const propName of Object.keys(slots)) {
    if (out[propName] !== undefined) continue;
    const slot = slots[propName];
    if (slot === undefined) continue;
    const value = lookupThemeSlot(theme, slot);
    if (value !== undefined) out[propName] = value;
  }
  return out as P;
}

function lookupThemeSlot(theme: Theme, slot: ThemeSlot): string | number | undefined {
  if (slot.kind === 'palette') {
    return theme.palette?.[slot.role];
  }
  return theme.tokens[slot.path];
}
