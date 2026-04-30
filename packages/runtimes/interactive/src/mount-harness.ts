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

import type {
  Element,
  InteractiveClip,
  InteractiveClipFamily,
  Permission,
} from '@stageflip/schema';

import type { ClipFactory, MountContext, MountHandle, TenantPolicy } from './contract.js';
import { PERMISSIVE_TENANT_POLICY } from './contract.js';
import { renderStaticFallback } from './fallback-rendering.js';
import { type EmitTelemetry, NOOP_EMIT_TELEMETRY, PermissionShim } from './permission-shim.js';
import { type InteractiveClipRegistry, interactiveClipRegistry } from './registry.js';
import {
  type StaticFallbackGeneratorRegistry,
  staticFallbackGeneratorRegistry,
} from './static-fallback-registry.js';

/**
 * Information passed to a `PermissionPrePromptHandler` so the host can
 * render the pre-prompt modal with the right copy. The handler returns a
 * promise that resolves to `'confirm'` (proceed to browser permission
 * dialog) or `'cancel'` (route to static fallback).
 */
export interface PermissionPrePromptInvocation {
  /** The clip family being mounted — drives copy selection. */
  family: InteractiveClipFamily;
  /** The first permission about to be requested — display target. */
  permission: Permission;
}

/**
 * T-385 D-T385-9 — host-supplied callback that renders the pre-prompt
 * explanation modal and resolves with the user's choice. Typically backed
 * by `<PermissionPrePromptModal>` rendered into a portal owned by the host.
 */
export type PermissionPrePromptHandler = (
  invocation: PermissionPrePromptInvocation,
) => Promise<'confirm' | 'cancel'>;

/**
 * Per-mount options for `InteractiveMountHarness.mount`. Backward-
 * compatible — pre-existing T-306 / T-383 / T-384 callers omit this
 * argument entirely.
 */
export interface InteractiveMountOptions {
  /**
   * When `true`, the harness yields a pre-prompt render cycle BEFORE the
   * shim's permission probe. Default `false`. Requires
   * `permissionPrePromptHandler` to be set on the harness; if absent, the
   * flag is ignored and the harness behaves as if `false`.
   */
  permissionPrePrompt?: boolean;
}

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
  /**
   * T-388a — override the static-fallback generator registry. Tests
   * inject a fresh one to avoid cross-test singleton pollution; production
   * code uses the module-level `staticFallbackGeneratorRegistry` populated
   * at clip-package import time.
   */
  staticFallbackGeneratorRegistry?: StaticFallbackGeneratorRegistry;
  /** Override the permission shim — tests inject a stub. */
  permissionShim?: PermissionShim;
  /** Tenant-policy hook; permissive default. */
  tenantPolicy?: TenantPolicy;
  /** Telemetry emitter; no-op default. */
  emitTelemetry?: EmitTelemetry;
  /**
   * T-385 D-T385-9 — host-supplied pre-prompt renderer. When
   * `mount(clip, root, signal, { permissionPrePrompt: true })` is invoked,
   * the harness calls this handler INSTEAD of going straight to the shim.
   * Resolving with `'confirm'` continues to the shim; `'cancel'` routes to
   * `staticFallback` with reason `'pre-prompt-cancelled'`. Optional —
   * absent + flag-on falls back to T-306 baseline (no pre-prompt).
   */
  permissionPrePromptHandler?: PermissionPrePromptHandler;
}

/**
 * Programmatic mount/unmount/dispose API for live clips. One harness per
 * editor / preview surface — its `PermissionShim` cache scopes to the
 * harness instance lifetime.
 */
export class InteractiveMountHarness {
  private readonly registry: InteractiveClipRegistry;
  private readonly staticFallbackGeneratorRegistry: StaticFallbackGeneratorRegistry;
  private readonly permissionShim: PermissionShim;
  private readonly tenantPolicy: TenantPolicy;
  private readonly emitTelemetry: EmitTelemetry;
  private readonly permissionPrePromptHandler: PermissionPrePromptHandler | undefined;

  constructor(options: InteractiveMountHarnessOptions = {}) {
    this.registry = options.registry ?? interactiveClipRegistry;
    this.staticFallbackGeneratorRegistry =
      options.staticFallbackGeneratorRegistry ?? staticFallbackGeneratorRegistry;
    this.tenantPolicy = options.tenantPolicy ?? PERMISSIVE_TENANT_POLICY;
    this.emitTelemetry = options.emitTelemetry ?? NOOP_EMIT_TELEMETRY;
    this.permissionShim =
      options.permissionShim ??
      new PermissionShim({
        tenantPolicy: this.tenantPolicy,
        emitTelemetry: this.emitTelemetry,
      });
    this.permissionPrePromptHandler = options.permissionPrePromptHandler;
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
  async mount(
    clip: InteractiveClip,
    root: HTMLElement,
    signal: AbortSignal,
    mountOptions: InteractiveMountOptions = {},
  ): Promise<MountHandle> {
    // Step 0 (T-385 D-T385-9): optional pre-prompt render cycle. Runs
    // BEFORE the shim so the user sees the in-app explanation before the
    // browser dialog. Skipped when:
    //   - the flag is off (default — matches T-306 baseline);
    //   - no handler is registered on the harness;
    //   - the clip declares no permissions (nothing to pre-explain).
    if (
      mountOptions.permissionPrePrompt === true &&
      this.permissionPrePromptHandler !== undefined &&
      clip.liveMount.permissions.length > 0
    ) {
      const firstPermission = clip.liveMount.permissions[0];
      if (firstPermission !== undefined) {
        const choice = await this.permissionPrePromptHandler({
          family: clip.family,
          permission: firstPermission,
        });
        if (choice === 'cancel') {
          this.emitTelemetry('mount-fallback', {
            family: clip.family,
            reason: 'pre-prompt-cancelled',
          });
          return this.mountStaticFallback(clip, root, signal, 'pre-prompt-cancelled');
        }
      }
    }

    // Step 1: permission shim — tenant-policy gate, then permission probes.
    const permissionResult = await this.permissionShim.mount(clip);

    if (!permissionResult.granted) {
      // Step 1a (denial path): render static fallback and return a
      // dispose-only handle.
      this.emitTelemetry('mount-fallback', {
        family: clip.family,
        reason: permissionResult.reason,
      });
      return this.mountStaticFallback(clip, root, signal, permissionResult.reason);
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
      ...(mountOptions.permissionPrePrompt !== undefined
        ? { permissionPrePrompt: mountOptions.permissionPrePrompt }
        : {}),
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
   *
   * T-388 D-T388-2 / D-T388-4 + T-388a D-T388a-3 — when
   * `clip.staticFallback` is empty AND the family has a registered
   * default-poster generator, the harness substitutes the generator's
   * output. Authored arrays are used verbatim. Dispatch is family-
   * agnostic via `staticFallbackGeneratorRegistry`.
   */
  private mountStaticFallback(
    clip: InteractiveClip,
    root: HTMLElement,
    signal: AbortSignal,
    reason: string,
  ): MountHandle {
    const elements = this.resolveStaticFallbackElements(clip, reason);
    const fallback = renderStaticFallback(elements, root);
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
   * Pick the Element[] to render on the static path. Family-agnostic per
   * T-388a D-T388a-3: dispatches via `staticFallbackGeneratorRegistry`.
   *
   * Two paths:
   *
   * 1. `clip.staticFallback.length > 0` — the authored array wins. If the
   *    family has a generator registered, the generator is still invoked
   *    with `reason: 'authored'` so the family's telemetry continues to
   *    fire on the authored path (matches T-388 AC #13 shape). The
   *    generator's RETURN value is ignored on this path; the authored
   *    array is what gets rendered.
   * 2. `clip.staticFallback.length === 0` — the registered generator's
   *    output is rendered. If no generator is registered for the family,
   *    we fall through to the empty authored array (the schema's
   *    non-empty refine prevents this in practice).
   */
  private resolveStaticFallbackElements(
    clip: InteractiveClip,
    reason: string,
  ): ReadonlyArray<Element> {
    const generator = this.staticFallbackGeneratorRegistry.resolve(clip.family);

    if (clip.staticFallback.length > 0) {
      // Authored fallback wins. Still call the generator (with reason
      // 'authored') so per-family telemetry fires; ignore its return.
      if (generator !== undefined) {
        generator({
          clip,
          reason: 'authored',
          emitTelemetry: this.emitTelemetry,
        });
      }
      return clip.staticFallback;
    }

    if (generator === undefined) {
      // No authored fallback AND no registered generator. The schema's
      // non-empty refine would have rejected this at parse time;
      // defensive return preserves the (empty) array. The harness's React
      // root renders nothing.
      return clip.staticFallback;
    }

    return generator({
      clip,
      reason,
      emitTelemetry: this.emitTelemetry,
    });
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
