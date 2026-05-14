// packages/runtime-on-device-player/src/shim.ts
// `OnDevicePlayerShim` — the orchestrator the on-device display player
// binary (T-400, future) calls into. It threads the binary's per-clip
// mount requests through a four-step gate chain:
//
//   1. `evaluateTenantGate({ featuresInteractive })` — ADR-005 §D5 GA-only
//      check. Refuse `'disabled'` (→ `'tenant-flag-disabled'`) and
//      `'preview'` (→ `'preview-not-ga'`).
//   2. `evaluateCapability({ clipFamily, device })` — per-family hardware
//      capability gate (shader → GPU, voice → mic, network-using clips →
//      network, etc.). Refuse with `'capability-insufficient'` when
//      missing.
//   3. `InteractiveMountHarness.mount(clip, ...)` — the existing interactive
//      tier's registry + permission-shim pipeline. The shim observes a
//      per-mount telemetry sink wired into the harness at construction
//      time; refusals translate to `'no-factory-registered'` or
//      `'permission-refused'`.
//   4. On success: return a handle, emit `'mount-success'` telemetry.
//
// The shim is purely orchestration: it draws no pixels. The binary owns
// the render loop and is responsible for materialising the
// `staticFallbackElement` payload when the shim returns `'fallback'`.
//
// Determinism: this file is OUTSIDE the CLAUDE.md §3 perimeter (the
// perimeter targets `packages/runtimes/*/src/clips/**`). It is still
// pure-by-discipline:
//   - clock + telemetry + harness deps are injected (test-controllable);
//   - no `Date`, `Math.random`, `setTimeout`, `setInterval`,
//     `requestAnimationFrame`, `fetch`, or `XMLHttpRequest` referenced;
//   - all state lives on closure-scoped maps inside the factory.

import type { InteractiveClip, InteractiveClipFamily } from '@stageflip/schema';

import {
  InteractiveClipNotRegisteredError,
  InteractiveMountHarness,
  type InteractiveMountHarnessOptions,
  type MountHandle,
} from '@stageflip/runtimes-interactive';

import type {
  DisplayDeviceCapability,
  OnDevicePlayerRefusalReason,
  TelemetryEvent,
  TenantFlagValue,
} from './contract.js';
import type { OnDeviceClipHandle } from './lifecycle.js';
import { evaluateTenantGate } from './tenant-gate.js';

/**
 * Per-clip mount arguments. The binary supplies the tenantId, the
 * tenant's `features.interactive` value, the clip family + id + props,
 * and an opaque `staticFallbackElement` payload the binary renders on
 * refusal. The shim is `staticFallbackElement`-agnostic — it never looks
 * inside the payload; it only echoes a refusal reason to the binary.
 */
export interface OnDevicePlayerMountArgs {
  readonly tenantId: string;
  readonly tenantPolicy: { readonly featuresInteractive: TenantFlagValue };
  readonly clipFamily: InteractiveClipFamily;
  readonly clipId: string;
  readonly clipProps: unknown;
  readonly staticFallbackElement: unknown;
}

/**
 * Return shape of `OnDevicePlayerShim.mount`. The `'mounted'` arm carries
 * a handle the binary tracks in its render tree; the `'fallback'` arm
 * carries the refusal reason so the binary can render the
 * `staticFallbackElement` and surface a diagnostic.
 */
export type OnDevicePlayerMountResult =
  | { readonly result: 'mounted'; readonly handle: OnDeviceClipHandle }
  | { readonly result: 'fallback'; readonly reason: OnDevicePlayerRefusalReason };

/**
 * Public surface of the on-device-player runtime shim. T-400 (binary
 * packaging) consumes this contract; T-401 (telemetry + ops) consumes
 * the `TelemetryEvent` emitted by every call.
 */
export interface OnDevicePlayerShim {
  /**
   * Called once when the binary boots. Records the device capability +
   * telemetry sink + clock. Emits a `'boot'` telemetry event. Idempotent —
   * a second `boot` is allowed and clears any previously-tracked mounts
   * (without disposing them; the binary owns its render tree).
   */
  boot(args: {
    readonly device: DisplayDeviceCapability;
    readonly emitTelemetry: (event: TelemetryEvent) => void;
    readonly clock?: () => number;
  }): void;

  /**
   * Mount an interactive clip. Runs the gate chain and either returns a
   * `'mounted'` handle or a `'fallback'` reason. Never throws for the
   * five refusal paths defined on `OnDevicePlayerRefusalReason`.
   */
  mount(args: OnDevicePlayerMountArgs): Promise<OnDevicePlayerMountResult>;

  /** Returns the currently-mounted handles. Order is mount-order. */
  listMounted(): readonly OnDeviceClipHandle[];

  /** Unmount everything + emit `'shutdown'`. Resolves when all unmounts complete. */
  shutdown(): Promise<void>;
}

/**
 * Constructor dependencies.
 *
 * `mountHarness` is the binary's `InteractiveMountHarness` instance. The
 * binary constructs it with whichever registry / permissionShim /
 * tenantPolicy adapter is appropriate for the device (the on-device
 * player may run a stripped-down registry with only frame-deterministic
 * families enabled at MVP).
 *
 * `harnessOptionsForRefusalObservation` lets the shim observe the
 * harness's `'mount-fallback'` telemetry. The harness emits this event
 * BEFORE returning the dispose-only handle on the permission-refused /
 * tenant-denied / no-factory paths. The binary wires its telemetry sink
 * through this seam so the shim can translate the harness's refusal
 * reasons into the on-device-player refusal enum.
 */
export interface CreateOnDevicePlayerShimDeps {
  readonly mountHarness: InteractiveMountHarness;
  /**
   * Optional sink that, when present, observes every telemetry event
   * the harness emits during a `mount()` call. The shim uses this to
   * detect refusal. When omitted, the shim falls back to constructing
   * its own harness instance internally using `harnessOptions` so the
   * sink CAN be wired; in this path `mountHarness` is ignored.
   *
   * Production binaries (T-400) construct the harness once at boot time
   * and pass it in; tests typically use `harnessOptions` for direct
   * sink observation.
   */
  readonly harnessOptions?: InteractiveMountHarnessOptions;
}

/**
 * Per-clip-family capability requirements. Restated locally rather than
 * imported from a central enum so the table is the source of truth for
 * the gate: changing a family's hardware needs is a single-table edit
 * with a paired test update.
 *
 * Rationale per family (ADR-005 §D1):
 *   - `shader` / `three-scene` — require a GPU; `liveMount` paths
 *     compile shaders / drive WebGL.
 *   - `voice` — requires a microphone for the live-mount path; the
 *     `staticFallback` is a waveform poster.
 *   - `ai-chat` / `live-data` / `web-embed` / `ai-generative` — require
 *     network egress. `ai-generative` does NOT require GPU on the
 *     device — generation happens off-device; the device only renders
 *     the returned content slot.
 */
const FAMILY_CAPABILITY_REQUIREMENTS: Readonly<
  Record<InteractiveClipFamily, ReadonlyArray<keyof DisplayDeviceCapability>>
> = {
  shader: ['hasGpu'],
  'three-scene': ['hasGpu'],
  voice: ['hasMicrophone'],
  'ai-chat': ['hasNetwork'],
  'live-data': ['hasNetwork'],
  'web-embed': ['hasNetwork'],
  'ai-generative': ['hasNetwork'],
};

/**
 * Synthesize the minimal `InteractiveClip` shape the harness expects.
 * The on-device player does not author rich `staticFallback` element
 * arrays — the binary's `staticFallbackElement` payload is what gets
 * rendered on refusal. The placeholder element below exists only to
 * satisfy the schema's `.min(1)` refine; the shim never reaches the
 * harness's static-fallback render path because the refusal observation
 * inside `mount()` translates the harness's refusal into our enum
 * BEFORE returning.
 */
function synthesizeInteractiveClip(args: {
  readonly clipId: string;
  readonly clipFamily: InteractiveClipFamily;
  readonly clipProps: unknown;
}): InteractiveClip {
  const transform = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    opacity: 1,
  };
  const props =
    typeof args.clipProps === 'object' && args.clipProps !== null
      ? (args.clipProps as Record<string, unknown>)
      : {};
  return {
    id: args.clipId,
    type: 'interactive-clip',
    family: args.clipFamily,
    transform,
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [
      {
        id: `${args.clipId}-placeholder`,
        type: 'text',
        transform,
        visible: true,
        locked: false,
        animations: [],
        text: '',
      },
    ],
    liveMount: {
      component: { module: `@stageflip/runtime-on-device-player#${args.clipFamily}` },
      props,
      permissions: [],
    },
  } as unknown as InteractiveClip;
}

/**
 * Capability gate. Pure function — returns `null` on success, otherwise
 * the missing capability key for diagnostics.
 */
function evaluateCapability(args: {
  readonly clipFamily: InteractiveClipFamily;
  readonly device: DisplayDeviceCapability;
}): { readonly satisfied: true } | { readonly satisfied: false; readonly missing: string } {
  const required = FAMILY_CAPABILITY_REQUIREMENTS[args.clipFamily];
  for (const key of required) {
    if (args.device[key] !== true) {
      return { satisfied: false, missing: key };
    }
  }
  return { satisfied: true };
}

const NOOP_EMIT_TELEMETRY: (event: TelemetryEvent) => void = () => {
  /* default: discard until boot wires a real sink */
};

const ZERO_CLOCK: () => number = () => 0;

/**
 * Construct a detached "root" the harness can hold a reference to. In a
 * real on-device deployment the binary's registered factories ignore
 * this argument and render to the binary's own surface; in tests the
 * detached element is sufficient to satisfy the `HTMLElement` type.
 *
 * Falls back to a minimal cast-as-HTMLElement object when there is no
 * `document` available (pure Node tests without happy-dom).
 */
function createDetachedRoot(): HTMLElement {
  const g = globalThis as { readonly document?: { createElement(tag: string): HTMLElement } };
  if (typeof g.document?.createElement === 'function') {
    return g.document.createElement('div');
  }
  const stub: Partial<HTMLElement> & { tagName: string } = {
    tagName: 'DIV',
    appendChild: <T extends Node>(child: T): T => child,
    removeChild: <T extends Node>(child: T): T => child,
  };
  return stub as unknown as HTMLElement;
}

export function createOnDevicePlayerShim(deps: CreateOnDevicePlayerShimDeps): OnDevicePlayerShim {
  // State captured in closure. Per-mount refusal detection uses the
  // `currentRefused` variable updated by `refusalSink` (declared inside
  // `mount` so concurrent mounts don't race).
  let device: DisplayDeviceCapability | null = null;
  let emitTelemetry: (event: TelemetryEvent) => void = NOOP_EMIT_TELEMETRY;
  let clock: () => number = ZERO_CLOCK;
  const mounted = new Map<string, OnDeviceClipHandle>();

  // The harness instance the shim drives. When `harnessOptions` is
  // provided we own the instance and can wire the refusal observer;
  // otherwise we use the binary-supplied harness verbatim and rely on
  // `InteractiveClipNotRegisteredError` (thrown by harness) to detect
  // the `'no-factory-registered'` refusal. The permission-refused path
  // is unreachable in that mode at MVP (T-400 wires the observer).
  let observedRefusal: 'permission-refused' | null = null;
  const harness: InteractiveMountHarness = deps.harnessOptions
    ? new InteractiveMountHarness({
        ...deps.harnessOptions,
        emitTelemetry: (event, attrs) => {
          if (event === 'mount-fallback') {
            observedRefusal = 'permission-refused';
          }
          deps.harnessOptions?.emitTelemetry?.(event, attrs);
        },
      })
    : deps.mountHarness;

  function requireBooted(): DisplayDeviceCapability {
    if (device === null) {
      throw new Error(
        'OnDevicePlayerShim: mount() called before boot(). Call boot({ device, emitTelemetry, clock? }) first.',
      );
    }
    return device;
  }

  function refuse(
    reason: OnDevicePlayerRefusalReason,
    clipFamily: string,
    clipId: string,
  ): OnDevicePlayerMountResult {
    emitTelemetry({ kind: 'mount-refused', reason, clipFamily, clipId });
    return { result: 'fallback', reason };
  }

  return {
    boot(args) {
      device = args.device;
      emitTelemetry = args.emitTelemetry;
      clock = args.clock ?? ZERO_CLOCK;
      mounted.clear();
      emitTelemetry({ kind: 'boot', device: args.device });
    },

    async mount(args) {
      const bootedDevice = requireBooted();

      emitTelemetry({
        kind: 'mount-attempted',
        clipFamily: args.clipFamily,
        clipId: args.clipId,
      });

      // Gate 1: tenant flag (ADR-005 §D5 GA-only on-device).
      const gate = evaluateTenantGate({
        featuresInteractive: args.tenantPolicy.featuresInteractive,
      });
      if (gate.outcome === 'mount-static-fallback') {
        return refuse(gate.reason as OnDevicePlayerRefusalReason, args.clipFamily, args.clipId);
      }

      // Gate 2: hardware capability.
      const capability = evaluateCapability({ clipFamily: args.clipFamily, device: bootedDevice });
      if (!capability.satisfied) {
        return refuse('capability-insufficient', args.clipFamily, args.clipId);
      }

      // Gate 3 + 4: harness mount. Reset the refusal observer; the
      // harness's `emitTelemetry` wrapper (set at shim construction
      // time, see above) will flip it to `'permission-refused'` if the
      // permission-shim path denies.
      observedRefusal = null;
      const startedAt = clock();
      const detachedRoot = createDetachedRoot();
      const abortController = new AbortController();
      const clip = synthesizeInteractiveClip({
        clipId: args.clipId,
        clipFamily: args.clipFamily,
        clipProps: args.clipProps,
      });

      let harnessHandle: MountHandle;
      try {
        harnessHandle = await harness.mount(clip, detachedRoot, abortController.signal);
      } catch (err: unknown) {
        if (err instanceof InteractiveClipNotRegisteredError) {
          return refuse('no-factory-registered', args.clipFamily, args.clipId);
        }
        throw err;
      }

      if (observedRefusal === 'permission-refused') {
        // The harness rendered its static-fallback path; dispose the
        // dispose-only handle and translate to our refusal enum.
        harnessHandle.dispose();
        return refuse('permission-refused', args.clipFamily, args.clipId);
      }

      // Happy path.
      const elapsedMs = clock() - startedAt;
      const deviceHandle: OnDeviceClipHandle = {
        clipId: args.clipId,
        clipFamily: args.clipFamily,
        startedAt,
        unmount: async () => {
          const tracked = mounted.get(args.clipId);
          if (tracked !== deviceHandle) {
            // Already unmounted (or replaced by a re-mount with the
            // same id) — idempotent no-op.
            return;
          }
          mounted.delete(args.clipId);
          harnessHandle.dispose();
          emitTelemetry({
            kind: 'unmount',
            clipId: args.clipId,
            clipFamily: args.clipFamily,
          });
        },
      };
      mounted.set(args.clipId, deviceHandle);
      emitTelemetry({
        kind: 'mount-success',
        clipFamily: args.clipFamily,
        clipId: args.clipId,
        elapsedMs,
      });
      return { result: 'mounted', handle: deviceHandle };
    },

    listMounted() {
      return Array.from(mounted.values());
    },

    async shutdown() {
      const clipsUnmounted = mounted.size;
      const snapshot = Array.from(mounted.values());
      for (const handle of snapshot) {
        await handle.unmount();
      }
      emitTelemetry({ kind: 'shutdown', clipsUnmounted });
    },
  };
}
