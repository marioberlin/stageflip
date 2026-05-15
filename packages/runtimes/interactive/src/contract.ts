// packages/runtimes/interactive/src/contract.ts
// Public types for the interactive runtime tier per ADR-003 §D1 + T-306
// D-T306-2. Browser-safe — no Node-only imports. The contract is consumed
// by Phase γ frontier-clip families (T-340+) and by the editor / renderer
// shell that mounts them.
//
// `MountContext` carries the inputs the runtime gives a clip factory; the
// factory returns a `MountHandle` that is the editor's lever for
// updating + disposing a live mount. `AbortSignal` is the canonical
// async-cancellation pattern across StageFlip (T-261 presence subscribe,
// T-270 storage subscribeUpdates).

import type { InteractiveClip, Permission } from '@stageflip/schema';

import type { FrameSource } from './frame-source.js';

/**
 * Tenant-policy hook per ADR-005 §D3. T-306 ships a permissive default
 * (`{ canMount: () => true }`); production code wires a real implementation
 * in a follow-up that reads the tenant's feature-flag bundle. The shim
 * consults this BEFORE prompting the user for any browser permission, so
 * a tenant-disabled family never flashes a permission dialog.
 */
export interface TenantPolicy {
  /**
   * Return `true` if the calling tenant is permitted to mount the given
   * frontier-clip family. `false` short-circuits the mount to
   * `staticFallback`. Synchronous on purpose: the shim invokes it during
   * the mount-harness pre-flight check, before any async permission work.
   */
  canMount(family: InteractiveClip['family']): boolean;
}

/**
 * The mount-time inputs handed to a clip factory. ADR-003 §D4: `permissions`
 * have already been vetted by the runtime — callers can rely on every entry
 * being granted. Tenant-policy gating ran first; permission prompts ran
 * second; only after both passed does the factory see this context.
 */
export interface MountContext {
  /** The validated `InteractiveClip` schema instance being mounted. */
  clip: InteractiveClip;
  /** DOM node the factory mounts into. Owned by the caller. */
  root: HTMLElement;
  /**
   * Permission envelope already vetted by `PermissionShim`. Every entry is
   * GRANTED at the time of mount. Re-checking inside the factory is
   * acceptable but not required.
   */
  permissions: ReadonlyArray<Permission>;
  /** Tenant policy for further fine-grained checks. */
  tenantPolicy: TenantPolicy;
  /**
   * Telemetry hook (T-264 OpenTelemetry / observability). Factories emit
   * lifecycle / domain events here; the runtime forwards to OTel.
   */
  emitTelemetry: (event: string, attributes: Record<string, unknown>) => void;
  /**
   * Cancellation signal — when aborted, the factory must clean up DOM,
   * event listeners, network sockets, and any other side-effects. The
   * mount-harness wires this through to `MountHandle.dispose()` on abort.
   */
  signal: AbortSignal;
  /**
   * Optional frame source per T-383 D-T383-6. Frame-driven families
   * (`shader`, `three-scene`) MUST receive a non-`undefined` frame source
   * and assert at mount entry; event-driven families (`ai-chat`,
   * `web-embed`, etc.) ignore this field. Backward-compatible with the
   * T-306 contract — existing consumers neither read nor depend on this
   * field, so adding it does not break the contract-test suite.
   */
  frameSource?: FrameSource;
  /**
   * Per-mount opt-in for the T-385 pre-prompt explanation modal that runs
   * BEFORE the browser permission dialog (D-T385-4). `false` / `undefined`
   * matches the T-306 baseline — the harness calls
   * `permissionShim.mount(clip)` directly and does not yield a React
   * render cycle. `true` instructs the harness to render the pre-prompt
   * via the consumer-supplied surface (default `<PermissionPrePromptModal>`
   * or any component reading `usePermissionFlow`'s state). Backward-
   * compatible — pre-existing T-306 / T-383 / T-384 consumers omit the
   * field and continue to type-check.
   */
  permissionPrePrompt?: boolean;
  /**
   * T-403 R-13 — tenant identifier propagated from the harness's mount
   * call. When present, every clip-level telemetry event emitted by the
   * factory MUST include `tenantId` in its event payload so post-hoc
   * incident triage can scope events per-tenant. Optional for back-
   * compat with pre-T-403 R-13 callers (test fixtures, local dev rigs)
   * that did not yet thread tenant context; events from those mounts
   * fall through with no `tenantId` attribute (legacy shape).
   *
   * The seam mirrors `PermissionShimMountOptions.tenantId` (T-403 R-12)
   * and `TenantFlagGateInput.tenantId` (T-411c) — same identifier flows
   * through every gate so an operator can correlate denial telemetry
   * (`permission-denied` / `tenant-flag-denied`) with downstream clip
   * lifecycle telemetry (`shader-clip.mount.failure`,
   * `live-data-clip.fetch.error`, etc.).
   */
  tenantId?: string;
}

/**
 * Imperative handle returned by a clip factory. The editor uses this to
 * push prop updates without a full re-mount, and to dispose the mount
 * during unload paths separate from the AbortSignal (e.g., panel close).
 */
export interface MountHandle {
  /**
   * Update props on a live mount. Idempotent; calling with identical props
   * should be a no-op at the factory's discretion.
   */
  updateProps(props: Record<string, unknown>): void;
  /**
   * Dispose the mount. MUST be idempotent: calling twice is a no-op. The
   * mount-harness invokes this on `signal.abort()` and on its own
   * `unmount()` path; both routes converge here.
   */
  dispose(): void;
}

/**
 * The contract a frontier-clip family implements. Factories are registered
 * with `interactiveClipRegistry` at clip-package import time (Phase γ).
 * Factories are async to leave room for dynamic-import / WebGL-context /
 * AudioWorklet setup.
 */
export type ClipFactory = (ctx: MountContext) => Promise<MountHandle>;

/**
 * Permissive default tenant policy. The interactive runtime tier T-306
 * ships this as the fallback when no policy is supplied; production code
 * MUST inject a real implementation before GA per ADR-003 §D6.
 */
export const PERMISSIVE_TENANT_POLICY: TenantPolicy = {
  canMount: () => true,
};

/**
 * T-403 R-13 — clip-factory helper. Returns a telemetry emitter that
 * automatically injects `tenantId` (when `ctx.tenantId` is present) into
 * every event payload. The mount-time `tenantId` is authoritative — it
 * is spread AFTER per-call attributes so a clip cannot accidentally lie
 * about its tenant scope by setting a different `tenantId` in the
 * payload. When `ctx.tenantId` is `undefined`, the helper is a thin
 * pass-through and no `tenantId` key appears in emitted events
 * (preserves the pre-T-403-R-13 shape for back-compat with test rigs
 * that omit tenant context entirely).
 *
 * Clip factories thread their telemetry through this rather than
 * calling `ctx.emitTelemetry` directly, so per-call sites don't have
 * to remember to spread `tenantId`. Adopting the helper at every
 * `emitTelemetry` call site is the load-bearing R-13 closure.
 */
export function tenantScopedEmitter(ctx: MountContext): MountContext['emitTelemetry'] {
  const { tenantId } = ctx;
  if (tenantId === undefined) {
    return ctx.emitTelemetry;
  }
  return (event: string, attributes: Record<string, unknown>): void => {
    ctx.emitTelemetry(event, { ...attributes, tenantId });
  };
}
