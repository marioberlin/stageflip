// packages/runtimes/interactive/src/permission-flow/state.ts
// Pure state-machine transitions for the permission-flow UX (T-385 D-T385-2).
// Reducer-shaped so the React hook (`use-permission-flow.ts`) can drive it
// via `useReducer` and so the transitions are unit-testable without a React
// renderer. No browser API access here — `requestPermission()` is the
// caller's responsibility; this module only routes between states.

import type { Permission } from '@stageflip/schema';

import type { PermissionFlowState } from './types.js';

/**
 * Action input to the reducer. Each branch corresponds to a single
 * legitimate transition trigger:
 *
 * - `start` — entry point. With at least one permission, lands in either
 *   `pre-prompt` (if `prePrompt` is true) or `requesting`. With zero
 *   permissions, lands in `granted` directly (AC #2).
 * - `confirm-pre-prompt` — pre-prompt → requesting (AC #4).
 * - `cancel-pre-prompt` — pre-prompt → denied/'pre-prompt-cancelled' (AC #4).
 * - `granted` — requesting → granted.
 * - `denied` — requesting → denied (with shim's reason + denied permission).
 * - `retry` — denied → requesting, IFF reason is `'permission-denied'`.
 *   Tenant-denied + pre-prompt-cancelled retries are no-ops at this layer
 *   (the hook also clears the shim's cache; see AC #6).
 */
export type PermissionFlowAction =
  | {
      type: 'start';
      permissions: ReadonlyArray<Permission>;
      prePrompt: boolean;
    }
  | { type: 'confirm-pre-prompt' }
  | { type: 'cancel-pre-prompt' }
  | { type: 'granted'; permissions: ReadonlyArray<Permission> }
  | {
      type: 'denied';
      reason: 'tenant-denied' | 'permission-denied';
      deniedPermission?: Permission;
    }
  | { type: 'retry' };

/** Initial state: idle. */
export const INITIAL_PERMISSION_FLOW_STATE: PermissionFlowState = { kind: 'idle' };

/**
 * Reducer. Illegal transitions return the current state unchanged so the
 * UI stays consistent and the consumer can surface a no-op deterministically.
 */
export function permissionFlowReducer(
  state: PermissionFlowState,
  action: PermissionFlowAction,
): PermissionFlowState {
  switch (action.type) {
    case 'start': {
      // Always restart from any prior terminal state — the consumer may
      // re-mount the same clip after an upstream prop change.
      const first = action.permissions[0];
      if (first === undefined) {
        return { kind: 'granted', permissions: [] };
      }
      if (action.prePrompt) {
        return { kind: 'pre-prompt', permission: first };
      }
      return { kind: 'requesting', permission: first };
    }
    case 'confirm-pre-prompt': {
      if (state.kind !== 'pre-prompt') return state;
      return { kind: 'requesting', permission: state.permission };
    }
    case 'cancel-pre-prompt': {
      if (state.kind !== 'pre-prompt') return state;
      return {
        kind: 'denied',
        reason: 'pre-prompt-cancelled',
        deniedPermission: state.permission,
      };
    }
    case 'granted': {
      if (state.kind !== 'requesting') return state;
      return { kind: 'granted', permissions: action.permissions };
    }
    case 'denied': {
      if (state.kind !== 'requesting') return state;
      return {
        kind: 'denied',
        reason: action.reason,
        ...(action.deniedPermission !== undefined
          ? { deniedPermission: action.deniedPermission }
          : {}),
      };
    }
    case 'retry': {
      // AC #6 — tenant-denied retry is a no-op (tenant policy is not
      // user-overridable). Pre-prompt-cancelled retry is also a no-op at
      // this layer; the consumer must call `start()` again to re-enter
      // the pre-prompt branch.
      if (state.kind !== 'denied') return state;
      if (state.reason !== 'permission-denied') return state;
      const permission = state.deniedPermission;
      if (permission === undefined) return state;
      return { kind: 'requesting', permission };
    }
  }
}
