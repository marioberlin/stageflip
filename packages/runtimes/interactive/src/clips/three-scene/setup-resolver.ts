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
// SECURITY — R-4 (closes residual risk from `docs/security-review-track-a.md`
// §5 R-4, the largest code-injection surface in Track A): the dynamic
// `import()` previously accepted ANY module path written by a preset author.
// `resolveSetupRef` now requires the requested `modulePath` to match a
// prefix in `SETUP_REF_TRUSTED_MODULE_PREFIXES` BEFORE invoking the
// importer. The default is `[]` (deny-all, fail-closed); hosts seed
// trusted publisher prefixes at startup via
// `extendTrustedModulePrefixes(...)`. The pattern mirrors T-404 R-1's
// LiveData SSRF allowlist convention (PO decision: cheapest engineering
// path, matches the npm/marketplace pack-signing posture). The allowlist
// rejection runs BEFORE the importer call so an untrusted module path
// never reaches `import()` at all.
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
 * Trusted-publisher prefix allowlist for `setupRef` module paths (R-4).
 *
 * Default: `[]` (empty). `resolveSetupRef` rejects ANY module path when
 * the list is empty (deny-all-by-default, fail-closed posture). Hosts /
 * tenants / tests extend the list via {@link extendTrustedModulePrefixes}.
 *
 * Each entry is a string prefix tested via `modulePath.startsWith(prefix)`.
 * Typical seed values name pack-publisher scopes (e.g.
 * `'@stageflip/pack-frontier-fx'`) or first-party runtime packages (e.g.
 * `'@stageflip/runtimes-three'`). String prefixes — not regexes — because
 * the matching surface is npm package paths whose grammar is already
 * scope-prefixed (`@scope/name[/subpath]`).
 *
 * The module-level array is mutable through
 * {@link extendTrustedModulePrefixes} and
 * {@link __resetTrustedModulePrefixesForTests}. No determinism scope
 * concerns — the body of `resolveSetupRef` is path-matched but only reads
 * this array; the seed call sites live outside the determinism scope.
 */
const trustedModulePrefixes: string[] = [];

/**
 * Read-only view of the current trusted-publisher-prefix allowlist (R-4).
 * Returns a fresh snapshot each call so callers cannot mutate the
 * underlying array.
 */
export const SETUP_REF_TRUSTED_MODULE_PREFIXES = (): readonly string[] => [
  ...trustedModulePrefixes,
];

/**
 * Extend the trusted-publisher-prefix allowlist with additional prefixes
 * (R-4). MERGE semantics — calling twice extends; never replaces.
 * Duplicate prefixes are skipped to keep the array small.
 *
 * Typical use: a host shell calls this at startup with the
 * tenant-derived / marketplace-derived publisher scopes; tests call it
 * inside `beforeEach`.
 */
export function extendTrustedModulePrefixes(prefixes: readonly string[]): void {
  for (const prefix of prefixes) {
    if (!trustedModulePrefixes.includes(prefix)) {
      trustedModulePrefixes.push(prefix);
    }
  }
}

/**
 * Test-only reset of the trusted-publisher-prefix allowlist back to `[]`
 * (R-4). Underscored to flag it as not-for-production. The module has no
 * other writable state.
 */
export function __resetTrustedModulePrefixesForTests(): void {
  trustedModulePrefixes.length = 0;
}

function isTrustedModulePath(modulePath: string): boolean {
  return trustedModulePrefixes.some((prefix) => modulePath.startsWith(prefix));
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
 * message when the ref is malformed, the module path is not on the
 * trusted-publisher-prefix allowlist (R-4 — runs BEFORE the importer
 * call), the package is unimportable, the symbol is missing, or the
 * resolved value is not a function.
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
  // R-4: trusted-publisher gate runs BEFORE the importer call so an
  // untrusted modulePath never reaches dynamic `import()`.
  if (!isTrustedModulePath(modulePath)) {
    throw new Error(
      `resolveSetupRef: module '${modulePath}' is not on the trustedPublisherKeyIds allowlist (security review R-4)`,
    );
  }
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
