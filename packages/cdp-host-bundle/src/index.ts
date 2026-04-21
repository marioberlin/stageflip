// packages/cdp-host-bundle/src/index.ts
// Node-side public surface. Consumers (renderer-cdp) call
// `loadBundleSource()` to get the compiled IIFE as a string, then
// inline it into the host HTML. The React composition primitives are
// re-exported so renderer-cdp tests can drive the component directly
// without going through the bundle.

import { access, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export { Composition, BootedComposition, type CompositionProps } from './composition.js';
export {
  LIVE_RUNTIME_IDS,
  type LiveRuntimeId,
  registerAllLiveRuntimes,
} from './runtimes.js';

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

/**
 * Report on the compiled bundle: its size in bytes, plus a comparison
 * against a caller-supplied warning threshold. Intended as a
 * diagnostic hook for the parity CLI (T-101) and any operator-facing
 * doctor utility — flags a bundle that has ballooned without
 * requiring a CI gate failure (size-limit handles the hard bound).
 *
 * Default threshold is 1.75 MB raw; T-100e ships at ~1.59 MB after
 * registering all 6 runtimes, giving ~160 KB headroom. Callers
 * targeting tighter budgets should pass their own `warnAtBytes`.
 */
export interface BundleDoctorReport {
  readonly path: string;
  readonly exists: boolean;
  /** Raw byte size of the bundle (0 if `exists === false`). */
  readonly sizeBytes: number;
  /** Byte threshold above which `warn === true`. */
  readonly warnAtBytes: number;
  /** True when `sizeBytes > warnAtBytes`. */
  readonly warn: boolean;
  /** Human-readable summary: one line. */
  readonly message: string;
}

export async function bundleDoctor(opts?: {
  readonly warnAtBytes?: number;
}): Promise<BundleDoctorReport> {
  const warnAtBytes = opts?.warnAtBytes ?? 1_750_000; // 1.75 MB raw
  const path = await bundlePath();
  try {
    const st = await stat(path);
    const sizeBytes = st.size;
    const warn = sizeBytes > warnAtBytes;
    const kb = (sizeBytes / 1024).toFixed(1);
    const limitKb = (warnAtBytes / 1024).toFixed(0);
    const message = warn
      ? `cdp-host-bundle: ${kb} KB exceeds ${limitKb} KB warning threshold`
      : `cdp-host-bundle: ${kb} KB (within ${limitKb} KB threshold)`;
    return { path, exists: true, sizeBytes, warnAtBytes, warn, message };
  } catch {
    return {
      path,
      exists: false,
      sizeBytes: 0,
      warnAtBytes,
      warn: false,
      message: `cdp-host-bundle: bundle not found at ${path} — run \`pnpm --filter @stageflip/cdp-host-bundle build\``,
    };
  }
}
