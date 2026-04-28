// packages/runtimes/interactive/src/mount-harness.ts
// `InteractiveMountHarness` per T-306 D-T306-1 — programmatic API for
// mounting + unmounting + disposing live clips. The harness orchestrates
// the four steps:
//
//   1. `permissionShim.mount(clip)` — tenant-policy gate, then permission
//      prompts. ANY out-of-order step here breaks the security model
//      (tenant-deny must run BEFORE getUserMedia; otherwise a forbidden
//      tenant flashes a permission dialog).
//   2. On grant: `registry.resolve(family)` — must be registered, else
//      `InteractiveClipNotRegisteredError`.
//   3. Construct `MountContext`; invoke the factory; await its
//      `MountHandle`.
//   4. Wire `signal.abort` → `MountHandle.dispose()`. Idempotent dispose.
//
//   On denial (tenant or permission): render `staticFallback` via
//   `renderStaticFallback` — the export pipeline routing under ADR-003 §D3
//   continues to work; the live mount degrades gracefully.
//
// Browser-safe: no Node imports.

import type { InteractiveClip, InteractiveClipFamily } from '@stageflip/schema';

import type { ClipFactory, MountContext, MountHandle, TenantPolicy } from './contract.js';
import { PERMISSIVE_TENANT_POLICY } from './contract.js';
import { renderStaticFallback } from './fallback-rendering.js';
import { type EmitTelemetry, NOOP_EMIT_TELEMETRY, PermissionShim } from './permission-shim.js';
import { type InteractiveClipRegistry, interactiveClipRegistry } from './registry.js';

/**
 * Thrown when `harness.mount()` is called for a clip whose `family` has
 * no factory registered. Phase γ clip packages register at import time;
 * forgetting to import the package surface in the consuming app produces
 * this error at first mount.
 */
export class InteractiveClipNotRegisteredError extends Error {
  constructor(public readonly family: InteractiveClipFamily) {
    super(
      `No factory registered for interactive clip family '${family}'. Did the clip package import-time register-call run?`,
    );
    this.name = 'InteractiveClipNotRegisteredError';
  }
}

export interface InteractiveMountHarnessOptions {
  /** Override the registry — tests inject a fresh one to avoid global state. */
  registry?: InteractiveClipRegistry;
  /** Override the permission shim — tests inject a stub. */
  permissionShim?: PermissionShim;
  /** Tenant-policy hook; permissive default. */
  tenantPolicy?: TenantPolicy;
  /** Telemetry emitter; no-op default. */
  emitTelemetry?: EmitTelemetry;
}

/**
 * Programmatic mount/unmount/dispose API for live clips. One harness per
 * editor / preview surface — its `PermissionShim` cache scopes to the
 * harness instance lifetime.
 */
export class InteractiveMountHarness {
  private readonly registry: InteractiveClipRegistry;
  private readonly permissionShim: PermissionShim;
  private readonly tenantPolicy: TenantPolicy;
  private readonly emitTelemetry: EmitTelemetry;

  constructor(options: InteractiveMountHarnessOptions = {}) {
    this.registry = options.registry ?? interactiveClipRegistry;
    this.tenantPolicy = options.tenantPolicy ?? PERMISSIVE_TENANT_POLICY;
    this.emitTelemetry = options.emitTelemetry ?? NOOP_EMIT_TELEMETRY;
    this.permissionShim =
      options.permissionShim ??
      new PermissionShim({
        tenantPolicy: this.tenantPolicy,
        emitTelemetry: this.emitTelemetry,
      });
  }

  /**
   * Mount `clip` into `root`. Returns a `MountHandle`. The handle's
   * `dispose()` is idempotent and will be invoked automatically when
   * `signal` aborts.
   *
   * On tenant-policy or permission denial, the harness renders
   * `clip.staticFallback` into `root` via `renderStaticFallback` and
   * returns a `MountHandle` whose `dispose()` unmounts that React tree.
   * `updateProps` is a no-op on the static path.
   */
  async mount(clip: InteractiveClip, root: HTMLElement, signal: AbortSignal): Promise<MountHandle> {
    // Step 1: permission shim — tenant-policy gate, then permission probes.
    const permissionResult = await this.permissionShim.mount(clip);

    if (!permissionResult.granted) {
      // Step 1a (denial path): render static fallback and return a
      // dispose-only handle.
      this.emitTelemetry('mount-fallback', {
        family: clip.family,
        reason: permissionResult.reason,
      });
      return this.mountStaticFallback(clip, root, signal);
    }

    // Step 2: resolve the factory.
    const factory = this.registry.resolve(clip.family);
    if (!factory) {
      throw new InteractiveClipNotRegisteredError(clip.family);
    }

    // Step 3: build context + invoke factory.
    const context: MountContext = {
      clip,
      root,
      permissions: permissionResult.permissions,
      tenantPolicy: this.tenantPolicy,
      emitTelemetry: this.emitTelemetry,
      signal,
    };

    const handle = await factory(context);

    // Step 4: wire abort → dispose. Idempotent dispose is the factory's
    // contract; the harness wraps it once more here for symmetry with the
    // static path.
    return this.wrapWithAbortBinding(handle, signal);
  }

  /**
   * Render `staticFallback` via React and return a MountHandle that
   * unmounts that root on dispose. `updateProps` is a no-op (the static
   * path is frozen at the schema's declared element array).
   */
  private mountStaticFallback(
    clip: InteractiveClip,
    root: HTMLElement,
    signal: AbortSignal,
  ): MountHandle {
    const fallback = renderStaticFallback(clip.staticFallback, root);
    let disposed = false;
    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      fallback.root.unmount();
    };
    const onAbort = (): void => dispose();
    if (signal.aborted) {
      dispose();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    return {
      updateProps: () => {
        /* static path: props are frozen */
      },
      dispose,
    };
  }

  /**
   * Wrap a factory-returned `MountHandle` so that:
   *   - `dispose()` is idempotent (factory MAY already enforce; we enforce
   *     a second time so the harness's contract holds even for naive
   *     factories).
   *   - `signal.abort` triggers the same dispose path.
   */
  private wrapWithAbortBinding(handle: MountHandle, signal: AbortSignal): MountHandle {
    let disposed = false;
    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      handle.dispose();
    };
    const onAbort = (): void => dispose();
    if (signal.aborted) {
      dispose();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    return {
      updateProps: (props) => handle.updateProps(props),
      dispose,
    };
  }
}

/**
 * Convenience helper for one-shot factory registration in tests.
 * Production code should register on `interactiveClipRegistry` directly
 * at clip-package import time (Phase γ).
 */
export function registerInteractiveClip(
  family: InteractiveClipFamily,
  factory: ClipFactory,
  registry: InteractiveClipRegistry = interactiveClipRegistry,
): void {
  registry.register(family, factory);
}
