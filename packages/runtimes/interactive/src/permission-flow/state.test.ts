// packages/runtimes/interactive/src/permission-flow/state.test.ts
// T-385 AC #1–#6 — pure-reducer transition tests for the permission-flow
// state machine. No React, no browser APIs.

import { describe, expect, it } from 'vitest';

import {
  INITIAL_PERMISSION_FLOW_STATE,
  type PermissionFlowAction,
  permissionFlowReducer,
} from './state.js';
import type { PermissionFlowState } from './types.js';

function reduce(state: PermissionFlowState, action: PermissionFlowAction): PermissionFlowState {
  return permissionFlowReducer(state, action);
}

describe('permissionFlowReducer', () => {
  it('AC #1 — initial state is idle', () => {
    expect(INITIAL_PERMISSION_FLOW_STATE).toEqual({ kind: 'idle' });
  });

  it('AC #2 — start with no permissions transitions directly to granted', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'start',
      permissions: [],
      prePrompt: false,
    });
    expect(next).toEqual({ kind: 'granted', permissions: [] });
  });

  it('AC #2 — start with no permissions + prePrompt:true still transitions to granted', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'start',
      permissions: [],
      prePrompt: true,
    });
    expect(next.kind).toBe('granted');
  });

  it('AC #3 — start with permissions + prePrompt:false → requesting', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'start',
      permissions: ['mic'],
      prePrompt: false,
    });
    expect(next).toEqual({ kind: 'requesting', permission: 'mic' });
  });

  it('AC #3 — requesting → granted carries the granted permission list', () => {
    const requesting = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'start',
      permissions: ['mic'],
      prePrompt: false,
    });
    const next = reduce(requesting, { type: 'granted', permissions: ['mic'] });
    expect(next).toEqual({ kind: 'granted', permissions: ['mic'] });
  });

  it('AC #3 — requesting → denied carries reason + deniedPermission', () => {
    const requesting: PermissionFlowState = { kind: 'requesting', permission: 'mic' };
    const next = reduce(requesting, {
      type: 'denied',
      reason: 'permission-denied',
      deniedPermission: 'mic',
    });
    expect(next).toEqual({
      kind: 'denied',
      reason: 'permission-denied',
      deniedPermission: 'mic',
    });
  });

  it('AC #4 — start with prePrompt:true + permissions → pre-prompt', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'start',
      permissions: ['mic'],
      prePrompt: true,
    });
    expect(next).toEqual({ kind: 'pre-prompt', permission: 'mic' });
  });

  it('AC #4 — confirm-pre-prompt advances to requesting with the same permission', () => {
    const prePrompt: PermissionFlowState = { kind: 'pre-prompt', permission: 'mic' };
    const next = reduce(prePrompt, { type: 'confirm-pre-prompt' });
    expect(next).toEqual({ kind: 'requesting', permission: 'mic' });
  });

  it('AC #4 — cancel-pre-prompt → denied with reason pre-prompt-cancelled', () => {
    const prePrompt: PermissionFlowState = { kind: 'pre-prompt', permission: 'mic' };
    const next = reduce(prePrompt, { type: 'cancel-pre-prompt' });
    expect(next).toEqual({
      kind: 'denied',
      reason: 'pre-prompt-cancelled',
      deniedPermission: 'mic',
    });
  });

  it('AC #5 — retry from permission-denied → requesting on the same permission', () => {
    const denied: PermissionFlowState = {
      kind: 'denied',
      reason: 'permission-denied',
      deniedPermission: 'mic',
    };
    const next = reduce(denied, { type: 'retry' });
    expect(next).toEqual({ kind: 'requesting', permission: 'mic' });
  });

  it('AC #6 — retry from tenant-denied is a no-op', () => {
    const denied: PermissionFlowState = {
      kind: 'denied',
      reason: 'tenant-denied',
    };
    const next = reduce(denied, { type: 'retry' });
    expect(next).toBe(denied);
  });

  it('retry from pre-prompt-cancelled is a no-op (consumer must call start again)', () => {
    const denied: PermissionFlowState = {
      kind: 'denied',
      reason: 'pre-prompt-cancelled',
      deniedPermission: 'mic',
    };
    const next = reduce(denied, { type: 'retry' });
    expect(next).toBe(denied);
  });

  it('illegal transitions return state unchanged: confirm-pre-prompt from idle', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, { type: 'confirm-pre-prompt' });
    expect(next).toBe(INITIAL_PERMISSION_FLOW_STATE);
  });

  it('illegal transitions return state unchanged: granted from idle', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'granted',
      permissions: ['mic'],
    });
    expect(next).toBe(INITIAL_PERMISSION_FLOW_STATE);
  });

  it('illegal transitions return state unchanged: denied from idle', () => {
    const next = reduce(INITIAL_PERMISSION_FLOW_STATE, {
      type: 'denied',
      reason: 'permission-denied',
    });
    expect(next).toBe(INITIAL_PERMISSION_FLOW_STATE);
  });

  it('illegal transitions return state unchanged: cancel-pre-prompt from requesting', () => {
    const requesting: PermissionFlowState = { kind: 'requesting', permission: 'mic' };
    const next = reduce(requesting, { type: 'cancel-pre-prompt' });
    expect(next).toBe(requesting);
  });

  it('start can be invoked from any state to restart the flow', () => {
    const granted: PermissionFlowState = { kind: 'granted', permissions: ['mic'] };
    const next = reduce(granted, {
      type: 'start',
      permissions: ['camera'],
      prePrompt: false,
    });
    expect(next).toEqual({ kind: 'requesting', permission: 'camera' });
  });

  it('retry without deniedPermission is a no-op', () => {
    const denied: PermissionFlowState = {
      kind: 'denied',
      reason: 'permission-denied',
    };
    const next = reduce(denied, { type: 'retry' });
    expect(next).toBe(denied);
  });
});
