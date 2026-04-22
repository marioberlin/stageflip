// packages/parity-cli/src/puppeteer-primer.ts
// Real `PrimerFactory` + `PrimeInputResolver` implementations backed
// by @stageflip/renderer-cdp's `PuppeteerCdpSession` + `LiveTierAdapter`
// and @stageflip/cdp-host-bundle's browser IIFE.
//
// This file is what the `stageflip-parity prime` shim wires up at
// runtime. Unit tests don't touch it — they use the seams in
// `prime-cli.ts` (PrimerFactory + PrimeInputResolver). The real
// behaviour is exercised by the T-119 render-e2e CI job once the
// goldens-priming CI step in T-119c invokes it.

import { loadBundleSource } from '@stageflip/cdp-host-bundle';
import {
  LiveTierAdapter,
  type MountedComposition,
  PuppeteerCdpSession,
  REFERENCE_FIXTURES,
  canRunReferenceRenders,
  createPuppeteerBrowserFactory,
  createRuntimeBundleHostHtml,
} from '@stageflip/renderer-cdp';
import type { RIRDocument } from '@stageflip/rir';

import { type PrimeInputResolver, defaultReferenceFrames } from './prime-cli.js';
import type { PrimeFixtureInput, PrimeRenderFn } from './prime.js';

export interface PuppeteerPrimerOptions {
  /** Optional Chrome/Chromium binary path override. Defaults to `canRunReferenceRenders()`'s probe. */
  readonly chromePath?: string;
  /** CaptureMode override. Defaults to 'auto' (BeginFrame on Linux, screenshot elsewhere). */
  readonly captureMode?: 'auto' | 'beginframe' | 'screenshot';
  /**
   * Milliseconds to wait for `window.__sf.ready` after the runtime bundle loads.
   * Defaults to 20000 because the bundle inlines React + 6 runtimes + the
   * composition renderer, and a cold first page load can comfortably exceed
   * the session default of 5s (especially on CI with an unwarmed Chrome).
   */
  readonly readyTimeoutMs?: number;
}

/**
 * Build the real primer: loads the runtime bundle, launches Chrome
 * lazily via the first `render()` call's mount, caches per-doc
 * `MountedComposition`s so repeat frames on the same doc don't re-
 * open pages, and exposes a `close()` that tears down both the pages
 * and the browser.
 */
export async function createPuppeteerPrimer(
  opts: PuppeteerPrimerOptions = {},
): Promise<{ render: PrimeRenderFn; close: () => Promise<void> }> {
  // Auto-detect Chrome when the caller didn't supply a path. Mirrors
  // how reference-render.e2e.test.ts resolves capability before
  // launching — puppeteer-core refuses to launch without an
  // executablePath or channel, and this check turns that failure mode
  // into a legible "no Chrome found" message at prime time.
  let chromePath = opts.chromePath;
  if (chromePath === undefined) {
    const capability = await canRunReferenceRenders();
    if (!capability.ok || capability.chromePath === null) {
      throw new Error(
        `stageflip-parity prime: ${capability.reason ?? 'Chrome not found'}. ` +
          'Set PUPPETEER_EXECUTABLE_PATH or install Chrome at a standard location.',
      );
    }
    chromePath = capability.chromePath;
  }
  const bundleSource = await loadBundleSource();
  const session = new PuppeteerCdpSession({
    browserFactory: createPuppeteerBrowserFactory({ executablePath: chromePath }),
    hostHtmlBuilder: createRuntimeBundleHostHtml(bundleSource),
    captureMode: opts.captureMode ?? 'auto',
    readyTimeoutMs: opts.readyTimeoutMs ?? 20000,
  });
  const adapter = new LiveTierAdapter(session);
  const mountedByDoc = new Map<RIRDocument, MountedComposition>();

  const render: PrimeRenderFn = async (doc, frame) => {
    let mounted = mountedByDoc.get(doc);
    if (mounted === undefined) {
      mounted = await adapter.mount(doc);
      mountedByDoc.set(doc, mounted);
    }
    return adapter.renderFrame(mounted, frame);
  };

  const close = async (): Promise<void> => {
    for (const mounted of mountedByDoc.values()) {
      await adapter.close(mounted);
    }
    await session.closeSession();
  };

  return { render, close };
}

/**
 * Resolver that exposes the 3 hand-coded `REFERENCE_FIXTURES` from
 * `@stageflip/renderer-cdp` as `PrimeFixtureInput`s. Each fixture
 * gets the default [0, mid, last] snapshot set.
 */
export function createReferenceFixturesResolver(): PrimeInputResolver {
  return {
    async resolveReferenceFixtures(): Promise<readonly PrimeFixtureInput[]> {
      const out: PrimeFixtureInput[] = [];
      for (const [name, document] of Object.entries(REFERENCE_FIXTURES)) {
        out.push({
          name,
          document,
          frames: defaultReferenceFrames(document),
        });
      }
      return out;
    },
  };
}
