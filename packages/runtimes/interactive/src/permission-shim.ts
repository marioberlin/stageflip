// packages/runtimes/interactive/src/permission-shim.ts
// `PermissionShim` per ADR-003 §D4 + T-306 D-T306-3. Mount-time gate that:
//   1. Consults `tenantPolicy.canMount(family)` BEFORE any browser prompt.
//   2. Iterates `clip.liveMount.permissions` and resolves each via the
//      appropriate browser API. `mic` → `getUserMedia({audio:true})`.
//      `camera` → `getUserMedia({video:true})`. `network` is a no-op
//      (always granted; tracked for security review per ADR-003 §D6).
//   3. Caches granted permissions per (session, family) so a second mount
//      of the same family does not re-prompt the user.
//   4. Emits `permission-denied` telemetry on every denial — the security
//      review (ADR-003 §D6) consumes this stream.
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

/** Result of `PermissionShim.mount()`. */
export type PermissionResult =
  | {
      granted: true;
      permissions: ReadonlyArray<Permission>;
    }
  | {
      granted: false;
      fallbackTo: 'static';
      reason: 'tenant-denied' | 'permission-denied';
      deniedPermission?: Permission;
    };

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

  constructor(options: PermissionShimOptions = {}) {
    this.tenantPolicy = options.tenantPolicy ?? PERMISSIVE_TENANT_POLICY;
    this.emitTelemetry = options.emitTelemetry ?? NOOP_EMIT_TELEMETRY;
    this.browser = options.browser ?? defaultPermissionBrowserApi();
  }

  /**
   * Vet a clip's permission envelope. Returns `{granted:true,...}` if every
   * declared permission is allowed; `{granted:false,...}` if the tenant
   * denied the family or any permission was denied. ORDER MATTERS — tenant
   * policy is checked BEFORE any browser prompt so a denied-tenant clip
   * never flashes a permission dialog.
   */
  async mount(clip: InteractiveClip): Promise<PermissionResult> {
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
   * Request a single permission. `network` is a no-op (always granted —
   * the runtime trusts declared egress; ADR-003 §D6 follow-up will add a
   * tenant-level allowlist). `mic` and `camera` go through `getUserMedia`.
   */
  private async requestPermission(
    permission: Permission,
    _family: InteractiveClip['family'],
  ): Promise<boolean> {
    if (permission === 'network') {
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
