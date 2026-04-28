// packages/render-farm/src/selector.ts
// Render-farm adapter selector (T-266 D-T266-3). Reads the
// `STAGEFLIP_RENDER_FARM_ADAPTER` env var; default is `'in-memory'` so local
// dev + CI work without configuration. Production envs set `'k8s'` (or a
// future vendor key like `'coreweave'`) to bind the real adapter.
//
// The selector is pure: same env → same adapter type. We cache the constructed
// adapter per kind so repeated calls return the same instance (per AC #13's
// "instance reuse acceptable as a fast path"). Tests use `__resetSelectorCache`
// to clear.

import type { RenderFarmAdapter } from './contract.js';
import { InMemoryRenderFarmAdapter } from './in-memory.js';
import { KubernetesRenderFarmAdapter } from './k8s-stub.js';

/** Env var consulted by getRenderFarmAdapter. */
export const RENDER_FARM_ADAPTER_ENV_VAR = 'STAGEFLIP_RENDER_FARM_ADAPTER';

/** Recognised adapter kinds. Future vendors extend this union. */
export type RenderFarmAdapterKind = 'in-memory' | 'k8s';

const cache = new Map<RenderFarmAdapterKind, RenderFarmAdapter>();

/**
 * Resolve the configured adapter from an env-var bag. Throws if the env var
 * names an unknown adapter; defaulting to a working adapter on typo would
 * silently mis-route bake load.
 */
export function getRenderFarmAdapter(env: NodeJS.ProcessEnv = process.env): RenderFarmAdapter {
  const raw = env[RENDER_FARM_ADAPTER_ENV_VAR];
  const kind: string = raw === undefined || raw === '' ? 'in-memory' : raw;
  if (kind !== 'in-memory' && kind !== 'k8s') {
    throw new Error(
      `${RENDER_FARM_ADAPTER_ENV_VAR}: unknown adapter "${kind}"; expected "in-memory" or "k8s"`,
    );
  }
  const cached = cache.get(kind);
  if (cached !== undefined) return cached;
  const adapter: RenderFarmAdapter =
    kind === 'in-memory' ? new InMemoryRenderFarmAdapter() : new KubernetesRenderFarmAdapter();
  cache.set(kind, adapter);
  return adapter;
}

/** Test helper — clears the per-kind adapter cache. */
export function __resetSelectorCache(): void {
  cache.clear();
}
