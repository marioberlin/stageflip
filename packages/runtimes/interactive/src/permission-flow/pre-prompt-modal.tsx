// packages/runtimes/interactive/src/permission-flow/pre-prompt-modal.tsx
// `<PermissionPrePromptModal>` — default visual surface for the
// `pre-prompt` branch of `PermissionFlowState` (T-385 D-T385-6, AC #13–#14).
// All user-facing text is supplied via `messages` props; no English-string
// defaults live in this file (CLAUDE.md §10 + AC #18).

import type { JSX, MouseEventHandler } from 'react';

import type { PermissionFlowState, PermissionPrePromptMessages } from './types.js';

/** Props for `<PermissionPrePromptModal>`. */
export interface PermissionPrePromptModalProps {
  /** The current `pre-prompt` state slice. */
  state: Extract<PermissionFlowState, { kind: 'pre-prompt' }>;
  /** Localised copy supplied by the host application. */
  messages: PermissionPrePromptMessages;
  /** Confirm handler — advances to the browser permission dialog. */
  onConfirm(): void;
  /** Cancel handler — routes the mount to staticFallback. */
  onCancel(): void;
  /** Optional test-id forwarded to the root element (AC #14). */
  'data-testid'?: string;
}

/**
 * Render the pre-prompt explanation modal shown immediately before the
 * browser's native permission dialog. The component is unstyled / minimally
 * styled; apps theme via the `data-stageflip-*` attributes.
 */
export function PermissionPrePromptModal(props: PermissionPrePromptModalProps): JSX.Element {
  const { state, messages, onConfirm, onCancel } = props;
  const handleConfirm: MouseEventHandler<HTMLButtonElement> = () => {
    onConfirm();
  };
  const handleCancel: MouseEventHandler<HTMLButtonElement> = () => {
    onCancel();
  };

  return (
    <dialog
      open
      aria-modal="true"
      data-stageflip-permission-pre-prompt-modal=""
      data-stageflip-permission={state.permission}
      data-testid={props['data-testid']}
    >
      <h2 data-stageflip-slot="title">{messages.title}</h2>
      <p data-stageflip-slot="description">{messages.description}</p>
      <div data-stageflip-slot="actions">
        <button type="button" onClick={handleConfirm} data-stageflip-action="confirm">
          {messages.confirmLabel}
        </button>
        <button type="button" onClick={handleCancel} data-stageflip-action="cancel">
          {messages.cancelLabel}
        </button>
      </div>
    </dialog>
  );
}
