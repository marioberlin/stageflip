// packages/runtimes/interactive/src/host/browser-live-preview.tsx
// T-398 — Browser-live-preview host for the interactive tier. Wraps
// InteractiveMountHarness with React + DOM-container lifecycle, dispatches
// to staticFallback when tenant policy or permissions refuse live-mount.
// Per ADR-005 §D5, browser live-preview is preview-mode eligible (not
// GA-gated). Determinism: this file is in packages/runtimes/** which IS
// inside the determinism perimeter — use frame-derived timing only.
//
// `packages/runtimes/interactive/**` is exempted from the broad
// determinism rule per ADR-003 §D5 + T-306 D-T306-5, so this host's
// async lifecycle (Promise / setState) is allowed. No Date.now,
// Math.random, setTimeout, or setInterval is used regardless.

import type { InteractiveClip, InteractiveClipFamily, Permission } from '@stageflip/schema';
import * as React from 'react';

import type { MountHandle, TenantPolicy } from '../contract.js';
import { PERMISSIVE_TENANT_POLICY } from '../contract.js';
import { InteractiveMountHarness } from '../mount-harness.js';
import type { EmitTelemetry, PermissionShim } from '../permission-shim.js';
import { type InteractiveClipRegistry, interactiveClipRegistry } from '../registry.js';
import { TENANT_FLAG_GATING_MATRIX, type TenantFlagValue } from './tenant-flag-cache.js';

/**
 * Refusal reason emitted by the host's lifecycle stream when live-mount
 * is denied. Distinct from `MountHandle.dispose` paths — these refusals
 * happen BEFORE the factory is invoked.
 *
 * - `'feature-disabled'` — `tenantPolicy.featuresInteractive === 'disabled'`
 *   (or any value whose D-T411-4 matrix entry for `browser-live-preview` is
 *   `'static-fallback-only'`).
 * - `'permission-refused'` — `PermissionShim.mount()` returned
 *   `{ granted: false, reason: 'permission-denied' | 'tenant-denied' }`.
 *   (Tenant-deny shows up here too; from the consumer's POV both mean "we
 *   did not get to mount".)
 * - `'no-factory-registered'` — the interactive clip registry has no
 *   factory for the requested family.
 */
export type BrowserLivePreviewRefusalReason =
  | 'feature-disabled'
  | 'permission-refused'
  | 'no-factory-registered';

/**
 * Lifecycle stream emitted by `BrowserLivePreview` via the optional
 * `onLifecycle` callback. Useful for telemetry, dev-tools, and Storybook
 * harnesses that want to assert on the host's decisions without diving
 * into the underlying registry / shim.
 */
export type BrowserLivePreviewLifecycleEvent =
  | { readonly kind: 'mounted'; readonly handle: MountHandle }
  | { readonly kind: 'refused'; readonly reason: BrowserLivePreviewRefusalReason }
  | { readonly kind: 'unmounted' }
  | { readonly kind: 'error'; readonly error: Error };

/**
 * Tenant policy carrying both the family-level `canMount` check (existing
 * T-306 contract) and the deployment-target-level `featuresInteractive`
 * value (T-411 / ADR-005 §D3). The component reads
 * `featuresInteractive` against the
 * D-T411-4 matrix for the `'browser-live-preview'` target to decide
 * whether to attempt live-mount; the `canMount` check is delegated to the
 * underlying `PermissionShim` as part of the mount-time gate.
 */
export interface BrowserLivePreviewTenantPolicy extends TenantPolicy {
  /**
   * The `features.interactive` 3-state toggle per ADR-005 §D3 / T-411
   * D-T411-2. `'disabled'` denies live-mount on every target;
   * `'preview'` permits live-mount on `browser-live-preview`; `'ga'`
   * permits live-mount on every target.
   */
  readonly featuresInteractive: TenantFlagValue;
}

/** Props for {@link BrowserLivePreview}. */
export interface BrowserLivePreviewProps {
  /** Clip family discriminant (`'shader'` | `'three-scene'` | `'voice'` | ...). */
  readonly family: InteractiveClipFamily;
  /** Clip props (already validated against the family schema). */
  readonly props: Record<string, unknown>;
  /** Static-fallback element to render when live-mount is refused. */
  readonly staticFallback: React.ReactElement;
  /** Tenant policy from the apps' tenant settings. */
  readonly tenantPolicy: BrowserLivePreviewTenantPolicy;
  /** Optional: invoked on mount/unmount lifecycle transitions. */
  readonly onLifecycle?: (event: BrowserLivePreviewLifecycleEvent) => void;
  /**
   * Optional permission envelope to declare on the synthetic
   * `InteractiveClip` constructed by the host. Defaults to `[]` (no
   * browser permissions requested). Browser-live-preview consumers that
   * want to surface the permission dialog supply the family-appropriate
   * list here.
   */
  readonly permissions?: ReadonlyArray<Permission>;
  /**
   * T-403 R-13 — tenant identifier. When supplied, propagates into the
   * underlying `InteractiveMountHarness.mount()` so every clip-level
   * telemetry event the live-mount factory emits carries `tenantId`.
   * Optional for back-compat with pre-T-403-R-13 host shells; live-
   * preview surfaces that omit it continue to work but emit telemetry
   * without per-tenant scope.
   */
  readonly tenantId?: string;
  /**
   * Test-only override for the registry. Production code uses the
   * module-level `interactiveClipRegistry` singleton.
   */
  readonly registry?: InteractiveClipRegistry;
  /**
   * Test-only override for the permission shim. Production code lets the
   * harness instantiate its own.
   */
  readonly permissionShim?: PermissionShim;
}

/**
 * Build a minimal `InteractiveClip` from the host's prop bag. Browser
 * live-preview does not consume the schema's element-array static
 * fallback — the host renders the React `staticFallback` directly — so
 * we supply a single placeholder element to satisfy the schema's
 * non-empty refine without surfacing it to the user.
 */
function synthesizeInteractiveClip(
  family: InteractiveClipFamily,
  props: Record<string, unknown>,
  permissions: ReadonlyArray<Permission>,
): InteractiveClip {
  const transform = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation: 0,
    opacity: 1,
  };
  return {
    id: 'browser-live-preview',
    type: 'interactive-clip',
    family,
    transform,
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [
      {
        id: 'browser-live-preview-placeholder',
        type: 'text',
        transform,
        visible: true,
        locked: false,
        animations: [],
        text: '',
      },
    ],
    liveMount: {
      component: { module: `@stageflip/runtimes-interactive#${family}` },
      props,
      permissions,
    },
  } as unknown as InteractiveClip;
}

/**
 * React component that mounts an interactive clip into a DOM container
 * via {@link InteractiveMountHarness}, gated by tenant policy. Renders
 * `staticFallback` when policy refuses live-mount (i.e.,
 * `featuresInteractive === 'disabled'`, no factory is registered for the
 * family, or the permission shim returns denial).
 *
 * Per ADR-005 §D5, browser live-preview is preview-mode eligible — the
 * security gate is GA-only (T-405 records pending human review). The
 * `'preview'` and `'ga'` postures both proceed to live-mount on this
 * target.
 */
export function BrowserLivePreview(props: BrowserLivePreviewProps): React.ReactElement {
  const {
    family,
    props: clipProps,
    staticFallback,
    tenantPolicy,
    onLifecycle,
    permissions,
    tenantId,
    registry,
    permissionShim,
  } = props;

  // The decision state drives the render. `'pending'` is the very first
  // tick (effects have not run yet); we render the host shell so the ref
  // attaches, then the effect transitions us to one of the terminal
  // states. On any refused / errored path we render the React fallback.
  type Decision =
    | { kind: 'pending' }
    | { kind: 'mounted' }
    | { kind: 'refused'; reason: BrowserLivePreviewRefusalReason }
    | { kind: 'error'; error: Error };

  const [decision, setDecision] = React.useState<Decision>({ kind: 'pending' });

  // Cache the latest onLifecycle in a ref so the mount effect's deps do
  // NOT include it — a consumer that passes a fresh callback on every
  // render must not trigger an unmount/remount cycle.
  const onLifecycleRef = React.useRef<typeof onLifecycle>(onLifecycle);
  onLifecycleRef.current = onLifecycle;

  const fire = React.useCallback((event: BrowserLivePreviewLifecycleEvent): void => {
    const cb = onLifecycleRef.current;
    if (cb !== undefined) {
      cb(event);
    }
  }, []);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Refs that mirror props the mount effect should NOT depend on. Prop
  // changes propagate via ref but do not unmount/remount the clip; a
  // consumer that wants live-prop updates calls `handle.updateProps()`
  // from the `onLifecycle` mounted event.
  const clipPropsRef = React.useRef(clipProps);
  clipPropsRef.current = clipProps;
  const tenantPolicyRef = React.useRef(tenantPolicy);
  tenantPolicyRef.current = tenantPolicy;
  const registryRef = React.useRef(registry);
  registryRef.current = registry;
  const permissionShimRef = React.useRef(permissionShim);
  permissionShimRef.current = permissionShim;
  const permissionsRef = React.useRef(permissions);
  permissionsRef.current = permissions;
  // T-403 R-13 — same ref-mirroring pattern as the other props so a
  // tenantId reference change does NOT trigger an unmount/remount cycle.
  const tenantIdRef = React.useRef(tenantId);
  tenantIdRef.current = tenantId;

  // Synchronous pre-check — feature-flag gate. The D-T411-4 matrix
  // decides; on `'static-fallback-only'` we short-circuit BEFORE the
  // mount effect runs. This is also the path the synchronous render
  // takes when re-rendered with a new policy value.
  const featureDecision =
    TENANT_FLAG_GATING_MATRIX[tenantPolicy.featuresInteractive]['browser-live-preview'];

  // T-403 R-16 — one-time same-origin isolation observability check.
  // Browser live-preview shares the editor's origin BY DESIGN (see
  // docs/security-architecture/live-preview-isolation.md). The check
  // walks the editor's localStorage keys at mount time and emits a
  // single telemetry warning if any credential-shaped key is present
  // — a defensive observability hook, not a blocking gate. Process-
  // module-level guard means the scan runs at most once per page
  // load even if the host mounts dozens of live-previews.
  React.useEffect(() => {
    auditLocalStorageForCredentialKeys();
  }, []);

  // Mount effect: feature flag pass → factory lookup → harness mount.
  // The effect re-runs when `family` changes (forcing a fresh mount).
  // Tenant-policy reference changes that DON'T affect the feature value
  // are absorbed via the dependency on `featureDecision` (a string).
  React.useEffect(() => {
    if (featureDecision === 'static-fallback-only') {
      setDecision({ kind: 'refused', reason: 'feature-disabled' });
      fire({ kind: 'refused', reason: 'feature-disabled' });
      return;
    }

    const effectiveRegistry = registryRef.current ?? interactiveClipRegistry;
    if (effectiveRegistry.resolve(family) === undefined) {
      setDecision({ kind: 'refused', reason: 'no-factory-registered' });
      fire({ kind: 'refused', reason: 'no-factory-registered' });
      return;
    }

    const container = containerRef.current;
    if (container === null) {
      // Container not attached yet — should not happen because the
      // shell is rendered before the effect runs, but bail safely.
      return;
    }

    const abortController = new AbortController();
    // `cancelled` guards setState after unmount; React 19 strict-mode
    // double-invokes effects, and the first cleanup may run before the
    // mount promise resolves.
    let cancelled = false;
    let mountedHandle: MountHandle | null = null;
    let refusedDuringMount = false;

    // Telemetry sink: detect refusal via the harness's mount-fallback
    // event. The harness emits 'mount-fallback' BEFORE returning a
    // dispose-only handle for the static path; we use that to flip our
    // decision and unmount the harness's static-fallback render in
    // favour of our React fallback.
    const emitTelemetry: EmitTelemetry = (event, _attrs) => {
      if (event === 'mount-fallback') {
        refusedDuringMount = true;
      }
    };

    const currentShim = permissionShimRef.current;
    const harness = new InteractiveMountHarness({
      registry: effectiveRegistry,
      tenantPolicy: tenantPolicyRef.current,
      emitTelemetry,
      ...(currentShim !== undefined ? { permissionShim: currentShim } : {}),
    });

    const clip = synthesizeInteractiveClip(
      family,
      clipPropsRef.current,
      permissionsRef.current ?? [],
    );

    // T-403 R-13 — propagate tenantId into the harness mount call so
    // every clip-level emitTelemetry payload carries it. Build the
    // options object with tenantId only when present so we preserve the
    // exactOptionalPropertyTypes posture in the harness's
    // InteractiveMountOptions type.
    const currentTenantId = tenantIdRef.current;
    const mountOptions = currentTenantId !== undefined ? { tenantId: currentTenantId } : {};

    harness
      .mount(clip, container, abortController.signal, mountOptions)
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }
        if (refusedDuringMount) {
          // The harness rendered its static-fallback path into our
          // container. Dispose that (idempotent), then transition to
          // our React fallback path. The React-fallback render flushes
          // the container clean because the ref-wrapping div is no
          // longer rendered.
          handle.dispose();
          setDecision({ kind: 'refused', reason: 'permission-refused' });
          fire({ kind: 'refused', reason: 'permission-refused' });
          return;
        }
        mountedHandle = handle;
        setDecision({ kind: 'mounted' });
        fire({ kind: 'mounted', handle });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setDecision({ kind: 'error', error });
        fire({ kind: 'error', error });
      });

    return () => {
      cancelled = true;
      abortController.abort();
      if (mountedHandle !== null) {
        mountedHandle.dispose();
        mountedHandle = null;
        fire({ kind: 'unmounted' });
      }
    };
    // Re-mount when family changes or when the feature decision flips.
    // Other props (clipProps, tenantPolicy, registry, permissionShim,
    // permissions) flow through refs above so a re-render with a fresh
    // reference does NOT tear down + remount the clip. Consumers wanting
    // live-prop updates should call `handle.updateProps()` from the
    // `onLifecycle` mounted event.
  }, [family, featureDecision, fire]);

  // Render branch: when live-mount is decided we render the
  // ref-attached host shell; on any other terminal state we render the
  // React fallback. Snapshot-callers can distinguish the two via the
  // `data-stageflip-host` attribute on the wrapper.
  if (decision.kind === 'mounted' || decision.kind === 'pending') {
    return (
      <div
        ref={containerRef}
        data-stageflip-host="browser-live-preview"
        data-stageflip-family={family}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />
    );
  }
  return staticFallback;
}

/**
 * Diagnostic helper — re-exports the gating decision logic so consumer
 * tests can assert on the (`featuresInteractive`, `'browser-live-preview'`)
 * cell without re-deriving it. Returns `'live-mount'` or
 * `'static-fallback-only'`.
 */
export function browserLivePreviewGatingDecision(
  featuresInteractive: TenantFlagValue,
): 'live-mount' | 'static-fallback-only' {
  return TENANT_FLAG_GATING_MATRIX[featuresInteractive]['browser-live-preview'];
}

// Re-export `PERMISSIVE_TENANT_POLICY` for ergonomic test consumption —
// it satisfies `TenantPolicy` but NOT `BrowserLivePreviewTenantPolicy`
// (no `featuresInteractive`). Callers must compose:
//   `{ ...PERMISSIVE_TENANT_POLICY, featuresInteractive: 'preview' }`
export { PERMISSIVE_TENANT_POLICY };

/**
 * T-403 R-16 — credential-shaped localStorage key patterns. Matched
 * case-insensitively. The list is intentionally narrow (substring
 * tokens, not regex) so the scanner stays cheap and the false-positive
 * surface is auditable. Anything that contains one of these tokens is
 * suspicious enough to warrant a one-time warning.
 */
const CREDENTIAL_KEY_TOKENS: ReadonlyArray<string> = [
  'apikey',
  'api_key',
  'api-key',
  'secret',
  'token',
  'bearer',
  'password',
  'credential',
];

/**
 * Module-level latch — the audit runs at most once per page load
 * regardless of how many `BrowserLivePreview` mounts happen. Mutating
 * a module-scope `let` is acceptable here because `runtimes/interactive`
 * is exempt from the determinism perimeter per ADR-003 §D5.
 */
let credentialAuditDone = false;

/**
 * Warning sink emitted by the credential-key audit. The default sink
 * prints via `console.warn`; tests / production hosts can swap in a
 * telemetry pipeline via `setLivePreviewCredentialAuditSink`.
 */
type CredentialAuditSink = (matchedKeys: ReadonlyArray<string>) => void;

let credentialAuditSink: CredentialAuditSink = (matchedKeys) => {
  // Default sink — host's console pipeline. Production hosts SHOULD
  // override via `setLivePreviewCredentialAuditSink` to route into
  // their telemetry stream rather than relying on console capture.
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(
      '[stageflip:browser-live-preview] credential-shaped localStorage keys detected; ' +
        'live-preview shares the editor origin so clip code can read these. ' +
        'See docs/security-architecture/live-preview-isolation.md.',
      { matchedKeys },
    );
  }
};

/**
 * Override the audit sink (telemetry routing). Returns the previous
 * sink so consumers can restore on test teardown. Hosts that wire a
 * proper OTel pipeline call this once at boot.
 */
export function setLivePreviewCredentialAuditSink(sink: CredentialAuditSink): CredentialAuditSink {
  const previous = credentialAuditSink;
  credentialAuditSink = sink;
  return previous;
}

/**
 * Test-only — reset the once-per-page latch so a test can re-run the
 * audit. Safe to call from production code but not useful there.
 */
export function __resetLivePreviewCredentialAuditForTests(): void {
  credentialAuditDone = false;
}

function auditLocalStorageForCredentialKeys(): void {
  if (credentialAuditDone) {
    return;
  }
  credentialAuditDone = true;
  // SSR / non-browser bundle — bail.
  if (typeof globalThis === 'undefined') {
    return;
  }
  const ls = (globalThis as { localStorage?: Storage }).localStorage;
  if (ls === undefined) {
    return;
  }
  let matched: string[] = [];
  try {
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (key === null) {
        continue;
      }
      const lower = key.toLowerCase();
      for (const token of CREDENTIAL_KEY_TOKENS) {
        if (lower.includes(token)) {
          matched.push(key);
          break;
        }
      }
    }
  } catch {
    // localStorage access can throw under privacy modes / disabled
    // storage; silently bail rather than crash the host.
    matched = [];
  }
  if (matched.length > 0) {
    credentialAuditSink(matched);
  }
}
