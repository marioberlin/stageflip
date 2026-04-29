// packages/runtimes/interactive/src/permission-flow/denial-banner.tsx
// `<PermissionDenialBanner>` — default visual surface for the
// `denied` branch of `PermissionFlowState` (T-385 D-T385-6, AC #10–#12).
// All user-facing text is supplied via `messages` props; the component has
// NO English-string defaults per CLAUDE.md §10 + AC #18. The component does
// NOT touch any browser API (AC #12) — it is a pure visual surface.

import type { JSX, MouseEventHandler } from 'react';

import type { PermissionDenialMessages, PermissionFlowState } from './types.js';

/** Props for `<PermissionDenialBanner>`. */
export interface PermissionDenialBannerProps {
  /**
   * The current `denied` state slice. The component renders the banner only
   * when the discriminator is `'denied'`; pass the literal state.
   */
  state: Extract<PermissionFlowState, { kind: 'denied' }>;
  /** Localised copy supplied by the host application. */
  messages: PermissionDenialMessages;
  /** Click-handler for the retry button. Required. */
  onRetry(): void;
  /**
   * Optional dismiss handler. If absent, no dismiss button is rendered even
   * if `messages.dismissLabel` is supplied (the callback is the gate).
   */
  onDismiss?(): void;
  /** Optional test-id forwarded to the root element (AC #14). */
  'data-testid'?: string;
}

/**
 * Render the permission-denial banner. The component is intentionally
 * unstyled / minimally-styled — apps theme via CSS targeting the data
 * attributes.
 */
export function PermissionDenialBanner(props: PermissionDenialBannerProps): JSX.Element {
  const { state, messages, onRetry, onDismiss } = props;
  const handleRetry: MouseEventHandler<HTMLButtonElement> = () => {
    onRetry();
  };
  const handleDismiss: MouseEventHandler<HTMLButtonElement> | undefined = onDismiss
    ? () => {
        onDismiss();
      }
    : undefined;

  return (
    <div
      role="alert"
      data-stageflip-permission-denial-banner=""
      data-stageflip-denial-reason={state.reason}
      data-testid={props['data-testid']}
    >
      <h2 data-stageflip-slot="title">{messages.title}</h2>
      <p data-stageflip-slot="description">{messages.description}</p>
      {messages.browserSettingsHint !== '' ? (
        <p data-stageflip-slot="browser-settings-hint">{messages.browserSettingsHint}</p>
      ) : null}
      <div data-stageflip-slot="actions">
        <button type="button" onClick={handleRetry} data-stageflip-action="retry">
          {messages.retryLabel}
        </button>
        {handleDismiss !== undefined && messages.dismissLabel !== undefined ? (
          <button type="button" onClick={handleDismiss} data-stageflip-action="dismiss">
            {messages.dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
