// packages/runtimes/interactive/src/permission-shim.ts
// `PermissionShim` per ADR-003 §D4 + T-306 D-T306-3. Mount-time gate that:
//   0. (T-411c) When `options.tenantFlagGate` is supplied, consults the
//      D-T411-4 `(features.interactive, target)` matrix via the cached
//      `TenantFlagCache.readSync` — synchronous, pure, no I/O. Default-
//      deny on cache miss per T-411 D-T411-5.
//   1. Consults `tenantPolicy.canMount(family)` BEFORE any browser prompt.
//   2. Iterates `clip.liveMount.permissions` and resolves each via the
//      appropriate browser API. `mic` → `getUserMedia({audio:true})`.
//      `camera` → `getUserMedia({video:true})`. `network` consults the
//      T-403 R-5 global host allowlist via `evaluateNetworkGate` —
//      warn-mode permits silently, enforce-mode (post
//      `ENFORCEMENT_STARTS_AT`) blocks on non-allowlisted hosts.
//      Decision is captured on `lastNetworkGateDecision` for telemetry.
//   3. Caches granted permissions per (session, family) so a second mount
//      of the same family does not re-prompt the user.
//   4. Emits `permission-denied` / `permission-denied-tenant-flag` /
//      `tenant-denied` telemetry on every denial — the security review
//      (ADR-003 §D6) consumes this stream.
//
// On any short-circuit (tenant denied, permission denied), the shim returns
// `{ granted: false, fallbackTo: 'static' }` and the mount-harness routes
// to `staticFallback`.
//
// BROWSER-BUNDLE SAFE: no `fs` / `path` / `child_process`. The shim
// touches `navigator.mediaDevices.getUserMedia` only — feature-detected so
// the package can be imported in a server-side bundle (it just won't be
// callable there).
//
// `MediaStream` cleanup: any granted stream's tracks are stopped immediately
// after permission is verified — the shim's job is the gate, not the
// streaming surface. The clip factory will request its own stream when it
// mounts.

import type { InteractiveClip, Permission } from '@stageflip/schema';

import { type MountContext, PERMISSIVE_TENANT_POLICY, type TenantPolicy } from './contract.js';
import {
  TENANT_FLAG_GATING_MATRIX,
  type TenantFlagCache,
  type TenantFlagTarget,
  type TenantFlagValue,
} from './host/tenant-flag-cache.js';
import { type NetworkGateDecision, evaluateNetworkGate } from './network-allowlist.js';

/** Result of `PermissionShim.mount()`. */
export type PermissionResult =
  | {
      granted: true;
      permissions: ReadonlyArray<Permission>;
    }
  | {
      granted: false;
      fallbackTo: 'static';
      reason: 'tenant-flag-denied' | 'tenant-denied' | 'permission-denied';
      deniedPermission?: Permission;
    };

/**
 * Per-mount tenant-flag gate (T-411c D-T411c-5). When supplied to
 * `PermissionShim.mount()`, the shim runs a NEW step 0 BEFORE the
 * existing tenant-policy gate: it reads the cached
 * `features.interactive` value for `(tenantId, target)` and short-
 * circuits to `staticFallback` if the D-T411-4 matrix says the target
 * is not permitted at the tenant's posture. When omitted, the shim
 * behaves exactly as the T-306 / T-385 baseline (back-compat).
 */
export interface TenantFlagGateInput {
  /** The host's session-scoped cache; only `readSync` is consulted on the hot path. */
  cache: TenantFlagCache;
  /** Tenant whose `features.interactive` value drives the gating decision. */
  tenantId: string;
  /** Deployment target per ADR-005 §D4 — drives the gating decision per the D-T411-4 matrix. */
  target: TenantFlagTarget;
}

/**
 * Mount-time options. Today carries only the optional tenant-flag
 * gate; future mount-time inputs (per-mount tenant-policy override,
 * permission pre-prompt UI selection, etc.) accrete here.
 */
export interface PermissionShimMountOptions {
  /** Optional T-411c tenant-flag gate; back-compat default behaves as T-306. */
  tenantFlagGate?: TenantFlagGateInput;
}

/**
 * Telemetry emitter — same signature as `MountContext.emitTelemetry`. The
 * shim takes it as a constructor argument so its denial events flow to the
 * same OTel pipeline as the mount-harness.
 */
export type EmitTelemetry = MountContext['emitTelemetry'];

/**
 * No-op telemetry emitter — used when the caller does not provide one.
 * The shim still emits all expected events; they just go to a sink.
 */
export const NOOP_EMIT_TELEMETRY: EmitTelemetry = () => {
  /* sink */
};

/**
 * Browser API surface the shim depends on. Extracted so tests can inject
 * a fake without monkey-patching the global `navigator`.
 */
export interface PermissionBrowserApi {
  /**
   * Browser `navigator.mediaDevices.getUserMedia`. Resolves with a
   * `MediaStream` on grant; rejects with a `DOMException` on denial. The
   * shim tracks both outcomes; on grant it stops the returned tracks
   * (they were a permission probe, not the live stream).
   */
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
}

/**
 * Default `PermissionBrowserApi` that delegates to the real browser. Falls
 * back to a permanently-rejecting stub if `navigator.mediaDevices` is not
 * present (server-side imports, older test envs).
 */
export function defaultPermissionBrowserApi(): PermissionBrowserApi {
  return {
    getUserMedia: async (constraints) => {
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        return navigator.mediaDevices.getUserMedia(constraints);
      }
      throw new Error('navigator.mediaDevices.getUserMedia is not available in this environment');
    },
  };
}

export interface PermissionShimOptions {
  /** Tenant-policy hook; permissive default if omitted. */
  tenantPolicy?: TenantPolicy;
  /** Telemetry emitter; no-op if omitted. */
  emitTelemetry?: EmitTelemetry;
  /** Browser API surface — defaults to `navigator.mediaDevices` proxy. */
  browser?: PermissionBrowserApi;
}

/**
 * Stateful permission gate. One instance per editor session — the
 * per-(session, family) cache means a user who granted mic to one shader
 * clip is not re-prompted when a second shader clip mounts in the same
 * session. Cache is intentionally session-scoped (instance lifetime); a
 * page reload resets it.
 */
export class PermissionShim {
  private readonly tenantPolicy: TenantPolicy;
  private readonly emitTelemetry: EmitTelemetry;
  private readonly browser: PermissionBrowserApi;

  /**
   * `(family, permission)` → granted? Caches successful grants only;
   * denials are NOT cached (re-prompting on re-mount lets the user change
   * their mind via browser UI).
   */
  private readonly grantCache = new Map<string, true>();

  /**
   * Most recent decision returned by the T-403 R-5 network gate, or
   * `null` if no `'network'` permission has been requested since
   * construction. Mutated only inside `requestPermission` when
   * `permission === 'network'`. Exposed for telemetry assertions and
   * for the future per-mount destination-host plumbing (clip-level
   * fetch wrapper).
   */
  lastNetworkGateDecision: NetworkGateDecision | null = null;

  constructor(options: PermissionShimOptions = {}) {
    this.tenantPolicy = options.tenantPolicy ?? PERMISSIVE_TENANT_POLICY;
    this.emitTelemetry = options.emitTelemetry ?? NOOP_EMIT_TELEMETRY;
    this.browser = options.browser ?? defaultPermissionBrowserApi();
  }

  /**
   * Vet a clip's permission envelope. Returns `{granted:true,...}` if every
   * declared permission is allowed; `{granted:false,...}` if the tenant
   * denied the family or any permission was denied. ORDER MATTERS — when
   * `options.tenantFlagGate` is supplied, the T-411c tenant-flag matrix
   * runs as STEP 0 (before any other check); then the existing
   * tenant-policy gate; then the per-permission browser prompts. Keeping
   * the tenant-flag gate outermost matches ADR-005 §D5 step 1 and means a
   * tenant whose `features.interactive` posture forbids live-mount never
   * flashes a permission dialog or invokes the family-policy hook.
   */
  async mount(
    clip: InteractiveClip,
    options: PermissionShimMountOptions = {},
  ): Promise<PermissionResult> {
    // Step 0: tenant-flag matrix gate (T-411c). Synchronous, cache-backed,
    // pure — see TenantFlagCache.readSync. Skipped when no gate input is
    // supplied (back-compat with T-306 / T-385 consumers).
    const flagGate = options.tenantFlagGate;
    if (flagGate !== undefined) {
      const cachedValue = flagGate.cache.readSync(flagGate.tenantId, flagGate.target);
      // Default-deny on cache miss per T-411 D-T411-5: `undefined` →
      // treat as `'disabled'`. Telemetry distinguishes the two via the
      // `flagValue` attribute so operators can tell "actively disabled"
      // from "tenant flag not loaded" at observability time.
      const effectiveValue: TenantFlagValue = cachedValue ?? 'disabled';
      const decision = TENANT_FLAG_GATING_MATRIX[effectiveValue][flagGate.target];
      if (decision === 'static-fallback-only') {
        this.emitTelemetry('permission-denied-tenant-flag', {
          family: clip.family,
          tenantId: flagGate.tenantId,
          target: flagGate.target,
          flagValue: cachedValue ?? 'cache-miss',
        });
        return { granted: false, fallbackTo: 'static', reason: 'tenant-flag-denied' };
      }
    }

    // Step 1: tenant-policy gate. Synchronous; runs before any I/O.
    if (!this.tenantPolicy.canMount(clip.family)) {
      this.emitTelemetry('tenant-denied', { family: clip.family });
      return { granted: false, fallbackTo: 'static', reason: 'tenant-denied' };
    }

    // Step 2: iterate declared permissions in declaration order.
    for (const permission of clip.liveMount.permissions) {
      const cacheKey = `${clip.family}:${permission}`;
      if (this.grantCache.has(cacheKey)) {
        continue;
      }
      const granted = await this.requestPermission(permission, clip.family);
      if (!granted) {
        this.emitTelemetry('permission-denied', {
          family: clip.family,
          permission,
        });
        return {
          granted: false,
          fallbackTo: 'static',
          reason: 'permission-denied',
          deniedPermission: permission,
        };
      }
      this.grantCache.set(cacheKey, true);
    }

    return { granted: true, permissions: clip.liveMount.permissions };
  }

  /**
   * Request a single permission. `network` consults the global host
   * allowlist gate (T-403 R-5). During the warn window
   * (`now < ENFORCEMENT_STARTS_AT`) the gate logs telemetry but still
   * permits the mount; after the cutover it returns `block` for non-
   * allowlisted hosts. v1: no per-mount destination is threaded
   * through, so `requestPermission` invokes the gate without a host —
   * the decision is the coarse permission-envelope-level approval that
   * the clip MAY use network at all. Per-call host enforcement is the
   * clip-level fetch wrapper's job (future R-5 follow-up).
   *
   * `mic` and `camera` go through `getUserMedia`.
   */
  private async requestPermission(
    permission: Permission,
    _family: InteractiveClip['family'],
  ): Promise<boolean> {
    if (permission === 'network') {
      // T-403 R-5: PO decision (2026-05-14) — warn-then-enforce. Until
      // ENFORCEMENT_STARTS_AT (2026-06-13), log non-allowlisted hosts
      // via telemetry but permit; after, block. The clip-level fetch
      // wrapper does the per-request enforcement; this gate is the
      // permission-envelope-level coarse approval that the clip MAY
      // use network at all.
      //
      // v1: no per-mount destination known → permit with mode-flag in
      // telemetry. The clip's network library is responsible for per-
      // call host enforcement (future T-404 follow-up).
      const decision = evaluateNetworkGate({ nowIso: new Date().toISOString() });
      this.lastNetworkGateDecision = decision;
      return true;
    }
    const constraints: MediaStreamConstraints =
      permission === 'mic' ? { audio: true } : { video: true };
    try {
      const stream = await this.browser.getUserMedia(constraints);
      // Stop the probe stream immediately — the clip factory acquires
      // its own when it mounts. Holding the track open here would leak
      // mic / camera state across the editor session.
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Test-only: clear the per-session grant cache. */
  clearCache(): void {
    this.grantCache.clear();
  }

  /**
   * Production-callable: clear a SINGLE granted entry (T-385 D-T385-3).
   * The permission-flow retry path uses this so a successful re-prompt
   * does not need to re-walk the full envelope or invalidate sibling
   * grants. No-op when the entry is absent.
   */
  clearCacheEntry(family: InteractiveClip['family'], permission: Permission): void {
    this.grantCache.delete(`${family}:${permission}`);
  }
}
