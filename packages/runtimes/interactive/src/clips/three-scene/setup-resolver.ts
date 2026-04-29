// packages/runtimes/interactive/src/clips/three-scene/setup-resolver.ts
// Dynamic-import + named-symbol resolution for `setupRef` (T-384 D-T384-3).
// Three.js scenes are imperative JavaScript — the author's `ThreeClipSetup`
// callback cannot be serialised inline like a GLSL fragment-shader string.
// Instead the preset declares a `<package>#<Symbol>` reference and the
// runtime resolves it at mount time.
//
// The factory injects an `importer` for tests so we can substitute a
// pre-built module record without spinning up a real package import. In
// production the importer is the platform's native dynamic `import()`.
//
// DETERMINISM SUB-RULE (T-309 / T-309a): path-matched. The body only calls
// `importer(...)` and `Object.prototype.hasOwnProperty` — no forbidden API.
//
// Browser-safe.

import type { ThreeClipSetup } from '@stageflip/runtimes-three';

import type { ComponentRef } from '@stageflip/schema';

/**
 * Module-import shape — the union of what native dynamic `import()` and a
 * test stub return. Both yield an object whose own enumerable properties
 * are the named exports.
 */
export type SetupModule = Record<string, unknown>;

/**
 * Pluggable importer. Production code passes the host's native dynamic
 * `import()`; tests pass a stub that returns a pre-built record.
 */
export type SetupImporter = (modulePath: string) => Promise<SetupModule>;

export interface ResolveSetupRefOptions {
  importer?: SetupImporter;
}

/**
 * Default importer — defers to the platform's native dynamic `import()`.
 * Wrapped so a test stub can be supplied via {@link ResolveSetupRefOptions.importer}.
 */
const defaultImporter: SetupImporter = (modulePath) =>
  import(/* @vite-ignore */ modulePath) as Promise<SetupModule>;

/**
 * Resolve a `componentRef.module` (`<package>#<Symbol>`) into the named
 * function export from the imported module. Throws with a descriptive
 * message when the ref is malformed, the package is unimportable, the
 * symbol is missing, or the resolved value is not a function.
 *
 * The return type is intentionally `ThreeClipSetup<Record<string, unknown>>`
 * — author setup callbacks can take any concrete props shape; the factory
 * passes through whatever schema-validated `setupProps` are declared.
 */
export async function resolveSetupRef(
  ref: ComponentRef,
  options: ResolveSetupRefOptions = {},
): Promise<ThreeClipSetup<Record<string, unknown>>> {
  const importer = options.importer ?? defaultImporter;
  const hashIdx = ref.module.indexOf('#');
  if (hashIdx < 0) {
    throw new Error(
      `resolveSetupRef: malformed module ref '${ref.module}' — expected '<package>#<Symbol>'`,
    );
  }
  const modulePath = ref.module.slice(0, hashIdx);
  const symbolName = ref.module.slice(hashIdx + 1);
  let mod: SetupModule;
  try {
    mod = await importer(modulePath);
  } catch (err) {
    throw new Error(
      `resolveSetupRef: dynamic import of '${modulePath}' failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const candidate = mod[symbolName];
  if (candidate === undefined) {
    throw new Error(`resolveSetupRef: module '${modulePath}' has no export named '${symbolName}'`);
  }
  if (typeof candidate !== 'function') {
    throw new Error(
      `resolveSetupRef: '${modulePath}#${symbolName}' resolved to ${typeof candidate}; expected function`,
    );
  }
  return candidate as ThreeClipSetup<Record<string, unknown>>;
}
