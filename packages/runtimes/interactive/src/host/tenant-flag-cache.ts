// packages/runtimes/interactive/src/host/tenant-flag-cache.ts
// TenantFlagCache per T-411c D-T411c-1 + D-T411c-2. Two-surface split:
//
//   - `readSync(tenantId, target)` — pure, synchronous, hot-path safe.
//     Called from `PermissionShim.mount()` at clip-mount time. No I/O,
//     no `await`, no `Date.now()` / `Math.random()` / network. Safe to
//     reach indirectly from determinism-gated code paths
//     (`packages/runtimes/**/src/clips/**`; CLAUDE.md §3).
//
//   - `populate(tenantId)` — async; the ONLY network / await surface.
//     Called from the host shell at session start (NOT from clip code).
//     Resolves the tenant's `features.interactive` value via the
//     injected `TenantFlagPopulator` and seeds entries for every
//     target in the D-T411-4 matrix.
//
// Default-deny on populator returning `null` (absent / unprovisioned
// tenant): the cache stores `'disabled'` for every target — the
// load-bearing T-411 D-T411-5 default. Default-deny on populator
// throwing: entries stay unset; subsequent `readSync` returns
// `undefined`, which the shim's mount-time path treats identically
// to `'disabled'` (D-T411c-6).
//
// The matrix `TENANT_FLAG_GATING_MATRIX` is encoded as a sealed const
// so TypeScript's exhaustiveness checking enforces every cell is
// handled. Values restated verbatim from T-411 §D-T411-4 (which
// itself restates ADR-005 §D3); both files MUST stay in sync.
//
// The cache does NOT import `@stageflip/storage` — runtimes-interactive
// is browser-bundle-safe; storage adapters are server-side. The
// populator is injected by the host (T-411c D-T411c-3) and may resolve
// the tenant settings via the storage adapter directly, via T-411b's
// HTTP route, or via any other source that satisfies the signature.

/**
 * The three deployment targets per ADR-005 §D4. Used as a cache key
 * dimension so the same tenant can have different gating outcomes
 * across html / browser-live-preview / on-device-display.
 */
export type TenantFlagTarget = 'html' | 'browser-live-preview' | 'on-device-display';

/**
 * The `features.interactive` 3-state toggle per ADR-005 §D3 / T-411
 * D-T411-2. `'disabled'` denies live-mount on every target; `'preview'`
 * permits live-mount on html + browser-live-preview only; `'ga'`
 * permits live-mount on every target.
 */
export type TenantFlagValue = 'disabled' | 'preview' | 'ga';

/**
 * Decision emitted by the gating matrix. `'live-mount'` means the shim
 * continues through its existing tenant-policy + permission-prompt
 * steps; `'static-fallback-only'` means the shim short-circuits to
 * staticFallback (mirroring the existing `tenant-denied` short-circuit).
 */
export type TenantFlagDecision = 'live-mount' | 'static-fallback-only';

/**
 * The (`features.interactive`, target) gating matrix from T-411
 * D-T411-4 (verbatim restatement of ADR-005 §D3). Encoded as a
 * `Readonly<Record<...>>` so TS enforces every cell is present.
 */
export const TENANT_FLAG_GATING_MATRIX: Readonly<
  Record<TenantFlagValue, Readonly<Record<TenantFlagTarget, TenantFlagDecision>>>
> = {
  disabled: {
    html: 'static-fallback-only',
    'browser-live-preview': 'static-fallback-only',
    'on-device-display': 'static-fallback-only',
  },
  preview: {
    html: 'live-mount',
    'browser-live-preview': 'live-mount',
    'on-device-display': 'static-fallback-only',
  },
  ga: {
    html: 'live-mount',
    'browser-live-preview': 'live-mount',
    'on-device-display': 'live-mount',
  },
};

/**
 * Async populator function signature. Resolves a tenant's
 * `features.interactive` value, or `null` when the tenant row does
 * not exist (the cache materialises the default-deny posture for
 * `null`). The populator is injected by the host shell — see
 * D-T411c-3.
 */
export type TenantFlagPopulator = (tenantId: string) => Promise<TenantFlagValue | null>;

/**
 * Read-only surface of the cache, narrowed for handing to the shim.
 * Consumers that only need the mount-time hot path accept this type
 * to make it impossible to accidentally call `populate` / `evict`
 * from clip code.
 */
export interface TenantFlagCache {
  /**
   * Sync read at mount time. Returns the cached value for
   * `(tenantId, target)`, or `undefined` when no entry has been
   * populated. Pure function over the in-process cache state — no
   * I/O, no `await`, no `Date.now()`. Safe to call from any code
   * path including the determinism-gated clip scope from CLAUDE.md §3
   * (`packages/runtimes/{kind}/src/clips/{name}/...`) — it makes no
   * `Map` mutations.
   */
  readSync(tenantId: string, target: TenantFlagTarget): TenantFlagValue | undefined;
}

/**
 * Mutable surface of the cache, used by the host shell for session
 * lifecycle management. The host narrows to `TenantFlagCache` when
 * threading the cache into the shim (D-T411c-2).
 */
export interface MutableTenantFlagCache extends TenantFlagCache {
  /**
   * Async populator entry-point. Called from the host shell at
   * session start (NOT from clip code). Resolves the tenant's
   * `features.interactive` value via the injected populator and
   * seeds entries for every target.
   *
   * Behaviour matrix:
   *   - populator → `'disabled'` / `'preview'` / `'ga'` → all three
   *     target entries store that value.
   *   - populator → `null` → all three target entries store
   *     `'disabled'` (default-deny per T-411 D-T411-5).
   *   - populator → throws → entries stay unset for this tenant; the
   *     error is re-thrown so callers can decide whether to retry
   *     or fail-open. Subsequent `readSync` returns `undefined`,
   *     which the shim treats identically to `'disabled'`.
   */
  populate(tenantId: string): Promise<void>;
  /**
   * Drain cache entries. With a `tenantId`, evict only that
   * tenant's entries (e.g., on tenant logout / impersonation
   * switch). With no argument, evict every entry (test teardown,
   * session end). No-op when the named tenant has no entries.
   */
  evict(tenantId?: string): void;
}

/**
 * Internal Map key — joins `tenantId` and `target` into a single
 * string. The composite key avoids nested Maps and makes
 * `evict(tenantId)` a single-pass key-prefix scan.
 */
function makeKey(tenantId: string, target: TenantFlagTarget): string {
  return `${tenantId}::${target}`;
}

export interface CreateTenantFlagCacheOptions {
  /**
   * Async populator function injected by the host shell. The cache
   * does not assume what the populator does internally — it may call
   * a `TenantSettingsStore` adapter, fetch a HTTP route, or return a
   * static value for tests.
   */
  populator: TenantFlagPopulator;
}

/**
 * Factory for the cache. Returns the mutable surface; callers narrow
 * to `TenantFlagCache` when handing the cache to the shim.
 */
export function createTenantFlagCache(
  options: CreateTenantFlagCacheOptions,
): MutableTenantFlagCache {
  const { populator } = options;
  // `entries` is the in-process cache, keyed on `${tenantId}::${target}`.
  // Map ordering is insertion order which is deterministic for a given
  // populate sequence — a property the tests rely on for predictability.
  const entries = new Map<string, TenantFlagValue>();
  // `tenantIds` shadows the set of tenants with at least one entry. We
  // use it for `evict(tenantId)` so we do not have to scan every key.
  const tenantTargets = new Map<string, Set<TenantFlagTarget>>();

  const ALL_TARGETS: ReadonlyArray<TenantFlagTarget> = [
    'html',
    'browser-live-preview',
    'on-device-display',
  ];

  function recordEntry(tenantId: string, target: TenantFlagTarget, value: TenantFlagValue): void {
    entries.set(makeKey(tenantId, target), value);
    let targetsForTenant = tenantTargets.get(tenantId);
    if (!targetsForTenant) {
      targetsForTenant = new Set();
      tenantTargets.set(tenantId, targetsForTenant);
    }
    targetsForTenant.add(target);
  }

  return {
    readSync(tenantId, target) {
      return entries.get(makeKey(tenantId, target));
    },

    async populate(tenantId) {
      // Re-throw populator errors so the host shell can decide what to
      // do. The cache leaves entries unset on throw — the shim's
      // mount-time path treats undefined identically to 'disabled'
      // (default-deny per T-411 D-T411-5).
      const resolved = await populator(tenantId);
      const value: TenantFlagValue = resolved ?? 'disabled';
      for (const target of ALL_TARGETS) {
        recordEntry(tenantId, target, value);
      }
    },

    evict(tenantId) {
      if (tenantId === undefined) {
        entries.clear();
        tenantTargets.clear();
        return;
      }
      const targetsForTenant = tenantTargets.get(tenantId);
      if (!targetsForTenant) {
        return;
      }
      for (const target of targetsForTenant) {
        entries.delete(makeKey(tenantId, target));
      }
      tenantTargets.delete(tenantId);
    },
  };
}
