// packages/mcp-server/src/populate.ts
// Convenience helper: build a BundleRegistry + ToolRouter populated
// with every canonical bundle in the engine. Mirrors the `populate`
// function inside `@stageflip/app-agent`'s orchestrator so the MCP
// server doesn't re-duplicate the registration list.
//
// Callers that need a narrower surface (e.g. only mode-specific
// bundles) can build their own registry + router + pass them into
// `createMcpServer` directly — `populateCanonicalRegistryForMcp` is
// just the happy-path default.

import {
  type BundleRegistry,
  ToolRouter,
  createCanonicalRegistry,
  registerClipAnimationBundle,
  registerCreateMutateBundle,
  registerDataSourceBindingsBundle,
  registerDisplayModeBundle,
  registerDomainBundle,
  registerElementCm1Bundle,
  registerFactCheckBundle,
  registerLayoutBundle,
  registerQcExportBulkBundle,
  registerReadBundle,
  registerSemanticLayoutBundle,
  registerSlideCm1Bundle,
  registerTableCm1Bundle,
  registerTimingBundle,
  registerValidateBundle,
  registerVideoModeBundle,
} from '@stageflip/engine';
import type { MutationContext } from '@stageflip/engine';

export interface PopulatedRegistry<TContext extends MutationContext> {
  readonly registry: BundleRegistry;
  readonly router: ToolRouter<TContext>;
}

/**
 * Register every canonical bundle (T-155..T-168, T-185, T-206) onto a
 * fresh registry + router pair. Caller owns both objects thereafter.
 *
 * `TContext` is constrained to `MutationContext` — the widest context
 * any canonical handler requires. Callers that only plan to serve
 * read-tier tools over MCP can still supply a `MutationContext` with
 * a no-op `patchSink`.
 */
export function populateCanonicalRegistryForMcp<
  TContext extends MutationContext = MutationContext,
>(): PopulatedRegistry<TContext> {
  const registry = createCanonicalRegistry();
  const router = new ToolRouter<TContext>();
  registerReadBundle(registry, router);
  registerCreateMutateBundle(registry, router);
  registerTimingBundle(registry, router);
  registerLayoutBundle(registry, router);
  registerValidateBundle(registry, router);
  registerClipAnimationBundle(registry, router);
  registerElementCm1Bundle(registry, router);
  registerSlideCm1Bundle(registry, router);
  registerTableCm1Bundle(registry, router);
  registerQcExportBulkBundle(registry, router);
  registerFactCheckBundle(registry, router);
  registerDomainBundle(registry, router);
  registerDataSourceBindingsBundle(registry, router);
  registerSemanticLayoutBundle(registry, router);
  registerVideoModeBundle(registry, router);
  registerDisplayModeBundle(registry, router);
  return { registry, router };
}
