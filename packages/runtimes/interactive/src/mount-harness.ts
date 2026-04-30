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

import { defaultVoiceStaticFallback } from './clips/voice/static-fallback.js';
import type { ClipFactory, MountContext, MountHandle, TenantPolicy } from './contract.js';
import { PERMISSIVE_TENANT_POLICY } from './contract.js';
import { renderStaticFallback } from './fallback-rendering.js';
import { type EmitTelemetry, NOOP_EMIT_TELEMETRY, PermissionShim } from './permission-shim.js';
import { type InteractiveClipRegistry, interactiveClipRegistry } from './registry.js';

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
  private readonly permissionShim: PermissionShim;
  private readonly tenantPolicy: TenantPolicy;
  private readonly emitTelemetry: EmitTelemetry;
  private readonly permissionPrePromptHandler: PermissionPrePromptHandler | undefined;

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
   * T-388 D-T388-2 / D-T388-4 — when `clip.staticFallback` is empty AND
   * the family has a registered default-poster generator (`voice` is the
   * first such family), the harness substitutes the generator's output.
   * Authored arrays are used verbatim.
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
   * Pick the Element[] to render on the static path. T-388 D-T388-4: for
   * `family: 'voice'`, an empty `staticFallback` triggers the default
   * waveform-poster generator. Authored arrays pass through unchanged.
   *
   * Per AC #14 telemetry privacy, `posterTextLength` is the integer
   * length, NOT the body. This method emits the
   * `voice-clip.static-fallback.rendered` event with the documented
   * shape; downstream consumers (renderer-cdp / observability pipeline)
   * key on the field names pinned here.
   */
  private resolveStaticFallbackElements(
    clip: InteractiveClip,
    reason: string,
  ): ReadonlyArray<Element> {
    if (clip.family !== 'voice') {
      // Other families do not yet ship a default generator; the
      // schema-level non-empty refine is the floor.
      return clip.staticFallback;
    }

    if (clip.staticFallback.length > 0) {
      // Authored fallback wins.
      this.emitTelemetry('voice-clip.static-fallback.rendered', {
        family: clip.family,
        reason: 'authored',
        width: clip.transform.width,
        height: clip.transform.height,
        posterTextLength: 0,
      });
      return clip.staticFallback;
    }

    const props = (clip.liveMount.props ?? {}) as { posterText?: unknown };
    const posterText = typeof props.posterText === 'string' ? props.posterText : undefined;
    const generated = defaultVoiceStaticFallback({
      width: clip.transform.width,
      height: clip.transform.height,
      ...(posterText !== undefined ? { posterText } : {}),
    });
    this.emitTelemetry('voice-clip.static-fallback.rendered', {
      family: clip.family,
      reason,
      width: clip.transform.width,
      height: clip.transform.height,
      // Privacy posture (AC #14): integer length, never the body.
      posterTextLength: posterText !== undefined ? posterText.length : 0,
    });
    return generated;
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
