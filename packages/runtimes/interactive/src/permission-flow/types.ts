// packages/runtimes/interactive/src/permission-flow/types.ts
// Public types for the permission-flow UX layer (T-385 D-T385-1, D-T385-6).
// All user-facing text is supplied by the host application — no English-string
// defaults live in this package per CLAUDE.md §10 + AC #18.

import type { Permission } from '@stageflip/schema';

/**
 * Localised copy supplied by the host application for the denial banner.
 * Every field is required; an empty string is acceptable when the app
 * deliberately suppresses a slot (e.g., no browser-settings hint).
 */
export interface PermissionDenialMessages {
  /** Headline, e.g., "Microphone access blocked". */
  title: string;
  /** Body text explaining what happened. */
  description: string;
  /** Label for the retry button. */
  retryLabel: string;
  /**
   * Generic instructions on how to grant the permission via the browser's
   * settings UI. Empty string disables the hint slot. Browser-detection is
   * intentionally out-of-scope (D-T385-7).
   */
  browserSettingsHint: string;
  /** Optional dismiss-button label; absent → no dismiss button rendered. */
  dismissLabel?: string;
}

/**
 * Localised copy supplied by the host application for the pre-prompt modal
 * shown before the browser permission dialog (D-T385-4).
 */
export interface PermissionPrePromptMessages {
  /** Headline, e.g., "Microphone access". */
  title: string;
  /** Body text explaining why the permission is requested. */
  description: string;
  /** Label for the confirm button (proceeds to browser dialog). */
  confirmLabel: string;
  /** Label for the cancel button (routes to staticFallback). */
  cancelLabel: string;
}

/**
 * Permission-flow state discriminator (D-T385-2). Drives the UX rendering
 * and is exhaustively switched in components / consumers.
 */
export type PermissionFlowState =
  | { kind: 'idle' }
  | { kind: 'pre-prompt'; permission: Permission }
  | { kind: 'requesting'; permission: Permission }
  | { kind: 'granted'; permissions: ReadonlyArray<Permission> }
  | {
      kind: 'denied';
      reason: 'tenant-denied' | 'permission-denied' | 'pre-prompt-cancelled';
      deniedPermission?: Permission;
    };
