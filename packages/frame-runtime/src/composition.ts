// packages/frame-runtime/src/composition.ts
// <Composition> + renderFrame — the entry point every other part of the
// frame-runtime feeds into.
//
// A composition declares a named, dimensioned, timed React component.
// Registration happens either programmatically via `registerComposition`
// or declaratively via the `<Composition>` JSX (which calls the imperative
// API during render). `renderFrame(id, frame, props?)` returns a React
// element that mounts the registered component inside a FrameProvider
// pinned to the requested frame.
//
// Design mirrors https://remotion.dev/docs/composition — the public-API
// surface; implementation is clean-sheet per CLAUDE.md §7.

import { type ComponentType, type ReactElement, createElement } from 'react';

import { FrameProvider, type VideoConfig } from './frame-context.js';

export interface CompositionDefinition<P = Record<string, unknown>> {
  /** Unique composition id. Looked up by `renderFrame`. Non-empty string. */
  id: string;
  /** React component rendered for each frame. */
  component: ComponentType<P>;
  /** Composition width in CSS pixels. Positive integer. */
  width: number;
  /** Composition height in CSS pixels. Positive integer. */
  height: number;
  /** Frames per second. Positive integer. */
  fps: number;
  /** Total length in frames. Positive integer. */
  durationInFrames: number;
  /** Props merged under any props passed to `renderFrame`. */
  defaultProps?: P;
}

const registry = new Map<string, CompositionDefinition<unknown>>();

/**
 * Register a composition imperatively. Throws on duplicate id or validation
 * failure.
 */
export function registerComposition<P>(def: CompositionDefinition<P>): void {
  validateDefinition(def);
  if (registry.has(def.id)) {
    throw new Error(`registerComposition: id '${def.id}' is already registered`);
  }
  registry.set(def.id, def as CompositionDefinition<unknown>);
}

/** Remove a composition from the registry. No-op if not present. */
export function unregisterComposition(id: string): void {
  registry.delete(id);
}

/** Read a composition definition by id, or `undefined` if not registered. */
export function getComposition(id: string): CompositionDefinition<unknown> | undefined {
  return registry.get(id);
}

/** Snapshot of every registered composition. */
export function listCompositions(): readonly CompositionDefinition<unknown>[] {
  return Array.from(registry.values());
}

/**
 * Test-only reset of the registry. Exported with a leading double-underscore
 * because it would corrupt a real application's composition list if called
 * at runtime. Vitest suites call this in beforeEach to isolate cases.
 */
export function __clearCompositionRegistry(): void {
  registry.clear();
}

export interface CompositionProps<P = Record<string, unknown>> extends CompositionDefinition<P> {}

/**
 * Declarative registration. Rendering this component calls
 * `registerComposition` synchronously during render (idempotent: re-renders
 * do not re-register a still-present id). Returns `null` — the actual
 * component is mounted only when `renderFrame` asks for it.
 */
export function Composition<P>(props: CompositionProps<P>): null {
  if (!registry.has(props.id)) {
    registerComposition(props);
  }
  return null;
}

/**
 * Render the component registered under `id` at a specific frame, optionally
 * overriding its defaultProps. Returns a React element wrapped in a
 * FrameProvider — suitable for passing straight to `ReactDOM.render` /
 * `renderToString` / a test renderer.
 *
 * @throws If `id` is not registered, `frame` is out of range, or `frame` is
 *   not a non-negative integer.
 */
export function renderFrame<P>(id: string, frame: number, props?: Partial<P>): ReactElement {
  const def = registry.get(id);
  if (def === undefined) {
    throw new Error(`renderFrame: composition '${id}' not registered`);
  }
  if (!Number.isInteger(frame)) {
    throw new Error(`renderFrame: frame must be an integer (got ${frame})`);
  }
  if (frame < 0) {
    throw new Error(`renderFrame: frame must be non-negative (got ${frame})`);
  }
  if (frame >= def.durationInFrames) {
    throw new Error(
      `renderFrame: frame ${frame} out of range for composition '${id}' (durationInFrames=${def.durationInFrames})`,
    );
  }

  const config: VideoConfig = {
    width: def.width,
    height: def.height,
    fps: def.fps,
    durationInFrames: def.durationInFrames,
  };

  const mergedProps = { ...(def.defaultProps ?? {}), ...(props ?? {}) };
  const Component = def.component as ComponentType<unknown>;
  const children = createElement(Component, mergedProps as Record<string, unknown>);

  return createElement(FrameProvider, { frame, config, children });
}

function validateDefinition<P>(def: CompositionDefinition<P>): void {
  if (typeof def.id !== 'string' || def.id.length === 0) {
    throw new Error('registerComposition: id must be a non-empty string');
  }
  if (typeof def.component !== 'function' && typeof def.component !== 'object') {
    throw new Error(`registerComposition: component is required for id '${def.id}'`);
  }
  validatePositiveInteger('width', def.width, def.id);
  validatePositiveInteger('height', def.height, def.id);
  validatePositiveInteger('fps', def.fps, def.id);
  validatePositiveInteger('durationInFrames', def.durationInFrames, def.id);
}

function validatePositiveInteger(field: string, value: number, id: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(
      `registerComposition: ${field} must be an integer (got ${value} for id '${id}')`,
    );
  }
  if (value <= 0) {
    throw new Error(`registerComposition: ${field} must be positive (got ${value} for id '${id}')`);
  }
}
