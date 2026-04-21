// packages/cdp-host-bundle/src/index.ts
// Node-side public surface. Consumers (renderer-cdp) call
// `loadBundleSource()` to get the compiled IIFE as a string, then
// inline it into the host HTML. The React composition primitives are
// re-exported so renderer-cdp tests can drive the component directly
// without going through the bundle.

import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export { Composition, BootedComposition, type CompositionProps } from './composition.js';

/**
 * Walk up from `start` until a directory containing `package.json`
 * with `name === @stageflip/cdp-host-bundle` is found. Resolves the
 * bundle path regardless of whether the caller imported from `src/`
 * (tests against source) or `dist/node/` (production). Throws if the
 * walk runs out of parents.
 */
const FIND_PACKAGE_ROOT_MAX_LEVELS = 10;

async function findPackageRoot(start: string): Promise<string> {
  let dir = start;
  let levels = 0;
  for (; levels < FIND_PACKAGE_ROOT_MAX_LEVELS; levels++) {
    try {
      const raw = await readFile(join(dir, 'package.json'), 'utf8');
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name === '@stageflip/cdp-host-bundle') return dir;
    } catch {
      // no package.json here — walk up.
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `cdp-host-bundle: could not locate @stageflip/cdp-host-bundle package root starting from ${start} (walked ${levels} levels, stopped at ${dir}; cap is ${FIND_PACKAGE_ROOT_MAX_LEVELS})`,
  );
}

/**
 * Resolve the compiled browser bundle as a string. Reads
 * `dist/browser/bundle.js` relative to this package's root. The
 * caller is responsible for inlining the returned string into a
 * `<script>` tag. The build step that emits the bundle is
 * `pnpm --filter @stageflip/cdp-host-bundle build`.
 *
 * Throws a diagnostic error if the bundle is missing — callers
 * typically surface this as a doctor hint ("run pnpm build first").
 */
export async function loadBundleSource(): Promise<string> {
  const path = await bundlePath();
  try {
    await access(path);
    return await readFile(path, 'utf8');
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(
      `cdp-host-bundle: could not read bundle at ${path}. Run ` +
        `\`pnpm --filter @stageflip/cdp-host-bundle build\` first. (${cause})`,
    );
  }
}

/**
 * Path-only variant — useful when the caller prefers to do its own
 * IO (e.g. stream the bundle into a response). Does not verify the
 * file exists; the returned path is where `loadBundleSource()`
 * would look.
 */
export async function bundlePath(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = await findPackageRoot(here);
  return join(root, 'dist', 'browser', 'bundle.js');
}
