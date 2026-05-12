// apps/audience-join/src/components/connection-status-banner.tsx
// T-456 — Surfaces the WebSocket connection state plus the
// `LF-AUDIENCE-CONNECTION-LOST` loss-flag emitted by `runAudienceClient`
// at reconnect-budget exhaustion (ADR-009 §D6).
//
// Browser-only. Outside the determinism perimeter (CLAUDE.md §3) — this
// is presentation code in an `apps/**` voter app, not clip code.

'use client';

import type { ReactElement } from 'react';

/**
 * Coarse-grained connection state surfaced to voters. Maps from
 * `runAudienceClient`'s internal lifecycle:
 *  - `idle`         → mount has not started yet (initial render).
 *  - `joining`      → minting voter token via `POST /v1/audience/sessions/:id/join`.
 *  - `connecting`   → opening the WebSocket subscription.
 *  - `connected`    → at least one snapshot received.
 *  - `reconnecting` → between attempts during the reconnect-budget window.
 *  - `disconnected` → terminal: budget exhausted (`LF-AUDIENCE-CONNECTION-LOST`)
 *                      or graceful close.
 *  - `error`        → terminal: voter-token mint or fatal subscribe error.
 */
export type ConnectionState =
  | 'idle'
  | 'joining'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

/** Inputs for `<ConnectionStatusBanner>`. */
export interface ConnectionStatusBannerProps {
  /** Current connection state. */
  readonly state: ConnectionState;
  /** Optional human-readable detail (e.g. error message). */
  readonly detail?: string;
  /**
   * `true` once the client emitted `LF-AUDIENCE-CONNECTION-LOST` (the
   * eight-attempt reconnect budget exhausted). Surfaced explicitly so
   * voters know to refresh the page or rejoin.
   */
  readonly connectionLost?: boolean;
}

const STATE_TEXT: Readonly<Record<ConnectionState, string>> = {
  idle: 'Initialising…',
  joining: 'Joining session…',
  connecting: 'Connecting to live updates…',
  connected: 'Connected — your votes are live.',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected from the live session.',
  error: 'Could not connect to the live session.',
};

/**
 * Renders the connection-state banner. The banner's severity (and
 * `data-severity` attribute) tracks state transitions so styling can
 * key off it without inspecting `data-state`.
 */
export function ConnectionStatusBanner(props: ConnectionStatusBannerProps): ReactElement {
  const { state, detail, connectionLost = false } = props;

  const severity: 'info' | 'warn' | 'error' =
    state === 'connected'
      ? 'info'
      : state === 'reconnecting'
        ? 'warn'
        : state === 'disconnected' || state === 'error'
          ? 'error'
          : 'info';

  return (
    <div
      data-testid="connection-status-banner"
      data-state={state}
      data-severity={severity}
      role={severity === 'error' ? 'alert' : 'status'}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
    >
      <span data-testid="connection-status-text">{STATE_TEXT[state]}</span>
      {detail !== undefined && detail !== '' ? (
        <span data-testid="connection-status-detail"> — {detail}</span>
      ) : null}
      {connectionLost ? (
        <span data-testid="connection-status-loss-flag" role="alert">
          {' '}
          (LF-AUDIENCE-CONNECTION-LOST: live updates have stopped — refresh to reconnect.)
        </span>
      ) : null}
    </div>
  );
}
