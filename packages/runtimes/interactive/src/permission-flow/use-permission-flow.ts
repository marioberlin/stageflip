// packages/runtimes/interactive/src/permission-flow/use-permission-flow.ts
// `usePermissionFlow` — React hook wrapping `PermissionShim` with a state
// machine + telemetry surface (T-385 D-T385-2). Consumers render against the
// returned `state` discriminator and call `start` / `confirmPrePrompt` /
// `cancelPrePrompt` / `retry` to drive transitions.
//
// The hook owns the side-effects:
//   - On entering `requesting`, calls `shim.mount(clip)` and dispatches
//     `granted` / `denied` based on the result.
//   - Emits the D-T385-5 telemetry envelope (pre-prompt shown / confirmed /
//     cancelled, dialog shown, retry clicked / granted / denied). Existing
//     shim events (`tenant-denied`, `permission-denied`) stay on the shim's
//     own emit channel — D-T385-5 events are layered on top, not a replacement.
//   - On `retry`, clears the failed permission's cache entry via
//     `shim.clearCacheEntry(family, permission)` then re-runs the flow.
//
// The hook is browser-safe: React + the shim's browser API surface only.

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { InteractiveClip } from '@stageflip/schema';

import type { EmitTelemetry, PermissionShim } from '../permission-shim.js';
import {
  INITIAL_PERMISSION_FLOW_STATE,
  type PermissionFlowAction,
  permissionFlowReducer,
} from './state.js';
import type { PermissionFlowState } from './types.js';

/** Options passed to `usePermissionFlow`. */
export interface UsePermissionFlowOptions {
  /** The shim instance — typically supplied by the host harness. */
  shim: PermissionShim;
  /**
   * Show the pre-prompt explanation modal BEFORE the browser permission
   * dialog. Default `false` — matches T-306 baseline.
   */
  prePrompt?: boolean;
  /**
   * Telemetry hook — receives the D-T385-5 events. Defaults to a no-op so
   * the hook is usable without a telemetry harness.
   */
  emitTelemetry?: EmitTelemetry;
}

/** Return shape of the hook. */
export interface UsePermissionFlowReturn {
  /** Current state — exhaustive discriminator. */
  state: PermissionFlowState;
  /** Begin the flow. Idempotent if already in a terminal state. */
  start(): void;
  /** Confirm the pre-prompt — advances to `requesting`. */
  confirmPrePrompt(): void;
  /**
   * Cancel the pre-prompt — transitions to `denied` with reason
   * `'pre-prompt-cancelled'`. The browser dialog never shows.
   */
  cancelPrePrompt(): void;
  /**
   * Retry after `permission-denied`. Clears the failed permission's cache
   * entry on the shim and re-enters `requesting`. No-op for tenant-denied
   * + pre-prompt-cancelled.
   */
  retry(): void;
}

const NOOP: EmitTelemetry = () => {
  /* sink */
};

/**
 * Drive the permission-flow state machine for `clip`. The hook is stable
 * across renders provided `clip` / `options.shim` / `options.prePrompt` are
 * referentially stable; the consumer is expected to memo or hoist them.
 */
export function usePermissionFlow(
  clip: InteractiveClip,
  options: UsePermissionFlowOptions,
): UsePermissionFlowReturn {
  const [state, dispatch] = useReducer(permissionFlowReducer, INITIAL_PERMISSION_FLOW_STATE);
  const emitTelemetry = options.emitTelemetry ?? NOOP;
  const shim = options.shim;
  const prePrompt = options.prePrompt ?? false;

  // Refs hold the latest mutable inputs so callbacks below stay stable
  // without forcing the consumer to memoize. Reading `.current` inside an
  // effect / callback is the standard React 19 pattern.
  const clipRef = useRef(clip);
  clipRef.current = clip;
  const shimRef = useRef(shim);
  shimRef.current = shim;
  const prePromptRef = useRef(prePrompt);
  prePromptRef.current = prePrompt;
  const emitRef = useRef(emitTelemetry);
  emitRef.current = emitTelemetry;

  // Retry attempt counter (per current denied permission).
  const retryAttemptRef = useRef(0);
  const inFlightRef = useRef(false);

  const dispatchAction = useCallback((action: PermissionFlowAction): void => {
    dispatch(action);
  }, []);

  const start = useCallback((): void => {
    const c = clipRef.current;
    const permissions = c.liveMount.permissions;
    retryAttemptRef.current = 0;
    if (permissions.length > 0 && prePromptRef.current) {
      const first = permissions[0];
      if (first !== undefined) {
        emitRef.current('permission.pre-prompt.shown', {
          family: c.family,
          permission: first,
        });
      }
    }
    dispatchAction({
      type: 'start',
      permissions,
      prePrompt: prePromptRef.current,
    });
  }, [dispatchAction]);

  const confirmPrePrompt = useCallback((): void => {
    // Only emit if currently in pre-prompt — avoid emitting on illegal calls.
    // We can't read state inside this callback synchronously without a ref;
    // we tolerate one-event-per-call here because the state-machine treats
    // the action as a no-op anyway. The reducer is the source of truth.
    const c = clipRef.current;
    const first = c.liveMount.permissions[0];
    if (first !== undefined) {
      emitRef.current('permission.pre-prompt.confirmed', {
        family: c.family,
        permission: first,
      });
    }
    dispatchAction({ type: 'confirm-pre-prompt' });
  }, [dispatchAction]);

  const cancelPrePrompt = useCallback((): void => {
    const c = clipRef.current;
    const first = c.liveMount.permissions[0];
    if (first !== undefined) {
      emitRef.current('permission.pre-prompt.cancelled', {
        family: c.family,
        permission: first,
      });
    }
    dispatchAction({ type: 'cancel-pre-prompt' });
  }, [dispatchAction]);

  const retry = useCallback((): void => {
    // Reduce a "fake" retry locally: only schedule shim work + telemetry
    // when the reducer would actually advance. We mirror the reducer's
    // guard via the same conditions on the latest state via the ref the
    // effect maintains below.
    const current = stateRef.current;
    if (current.kind !== 'denied') return;
    if (current.reason !== 'permission-denied') return;
    const permission = current.deniedPermission;
    if (permission === undefined) return;
    const c = clipRef.current;
    retryAttemptRef.current += 1;
    emitRef.current('permission.retry.clicked', {
      family: c.family,
      permission,
      attemptNumber: retryAttemptRef.current,
    });
    shimRef.current.clearCacheEntry(c.family, permission);
    dispatchAction({ type: 'retry' });
  }, [dispatchAction]);

  // Mirror state into a ref so retry() can read it synchronously.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Effect: when we enter `requesting`, run the shim.
  useEffect(() => {
    if (state.kind !== 'requesting') {
      inFlightRef.current = false;
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    let cancelled = false;
    const c = clipRef.current;
    const permission = state.permission;
    const attempt = retryAttemptRef.current;
    emitRef.current('permission.dialog.shown', {
      family: c.family,
      permission,
    });
    void shimRef.current.mount(c).then((result) => {
      if (cancelled) return;
      if (result.granted) {
        if (attempt > 0) {
          emitRef.current('permission.retry.granted', {
            family: c.family,
            permission,
            attemptNumber: attempt,
          });
        }
        dispatchAction({ type: 'granted', permissions: result.permissions });
      } else {
        if (attempt > 0 && result.reason === 'permission-denied') {
          emitRef.current('permission.retry.denied', {
            family: c.family,
            permission,
            attemptNumber: attempt,
          });
        }
        dispatchAction({
          type: 'denied',
          reason: result.reason,
          ...(result.deniedPermission !== undefined
            ? { deniedPermission: result.deniedPermission }
            : {}),
        });
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [state, dispatchAction]);

  return { state, start, confirmPrePrompt, cancelPrePrompt, retry };
}
