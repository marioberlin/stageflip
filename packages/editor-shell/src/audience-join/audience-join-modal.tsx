// packages/editor-shell/src/audience-join/audience-join-modal.tsx
// T-456 — `<AudienceJoinModal>` — the QR + room-code surface the editor
// mounts when a presenter opens an audience clip's "Invite voters"
// affordance. Tenant-feature-gated: hidden when
// `tenantAudienceEnabled === false` (renders a disabled-notice instead
// per ADR-009 §D3).
//
// Browser-only — uses the `qrcode` MIT lib to generate a data URL +
// `roomCodeFor` (Web Crypto-backed) from `@stageflip/audience-join-shared`.
//
// Outside the determinism perimeter (CLAUDE.md §3): editor-shell
// presentation code uses standard browser primitives.

import qrcode from 'qrcode';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { roomCodeFor, voterUrlFor } from '@stageflip/audience-join-shared';

/** Inputs for `<AudienceJoinModal>`. */
export interface AudienceJoinModalProps {
  /** ULID-shaped session id the editor opened (T-453 `openSession`). */
  readonly sessionId: string;
  /**
   * Public origin of the audience-join app, e.g.
   * `https://join.stageflip.app` or `http://localhost:3500` for dev.
   */
  readonly baseUrl: string;
  /**
   * Tenant feature flag from `TenantSettings.features.audience.enabled`
   * (ADR-009 §D3). When `false`, the modal renders a disabled-notice
   * instead of the QR + code.
   */
  readonly tenantAudienceEnabled: boolean;
  /** Handler invoked when the close button is clicked. */
  readonly onClose: () => void;
}

/**
 * Modal surface for inviting voters into a live audience session. Renders:
 *  - a QR encoding `voterUrlFor({ baseUrl, sessionId })` (PNG data URL
 *    via the `qrcode` MIT lib), and
 *  - a 6-character room code from `roomCodeFor(sessionId)` for hand entry
 *    (Crockford-style alphabet, no I/O/0/1).
 *
 * When `tenantAudienceEnabled === false`, the modal swaps to a
 * disabled-notice (audience features are off for the tenant).
 */
export function AudienceJoinModal(props: AudienceJoinModalProps): ReactElement {
  const { sessionId, baseUrl, tenantAudienceEnabled, onClose } = props;

  if (!tenantAudienceEnabled) {
    return (
      <dialog data-testid="audience-join-modal" open aria-modal="true">
        <header>
          <h2>Invite voters</h2>
          <button type="button" data-testid="audience-join-modal-close" onClick={onClose}>
            Close
          </button>
        </header>
        <p data-testid="audience-join-modal-disabled-notice">
          Audience features are disabled for your tenant. Contact your administrator to enable live
          audience sessions.
        </p>
      </dialog>
    );
  }

  const voterUrl = voterUrlFor({ baseUrl, sessionId });

  return (
    <dialog data-testid="audience-join-modal" open aria-modal="true">
      <header>
        <h2>Invite voters</h2>
        <button type="button" data-testid="audience-join-modal-close" onClick={onClose}>
          Close
        </button>
      </header>
      <RoomCode sessionId={sessionId} />
      <QrCode voterUrl={voterUrl} />
      <p>
        Or visit: <span data-testid="audience-join-modal-voter-url">{voterUrl}</span>
      </p>
    </dialog>
  );
}

interface RoomCodeProps {
  readonly sessionId: string;
}

function RoomCode({ sessionId }: RoomCodeProps): ReactElement {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    roomCodeFor(sessionId).then(
      (c) => {
        if (!cancelled) setCode(c);
      },
      () => {
        if (!cancelled) setCode(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (code === null) {
    return <div data-testid="audience-join-modal-room-code-pending">Generating code…</div>;
  }
  return (
    <div>
      Room code: <strong data-testid="audience-join-modal-room-code">{code}</strong>
    </div>
  );
}

interface QrCodeProps {
  readonly voterUrl: string;
}

function QrCode({ voterUrl }: QrCodeProps): ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    qrcode.toDataURL(voterUrl).then(
      (url) => {
        if (!cancelled) setDataUrl(url);
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'QR generation failed');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [voterUrl]);

  if (error !== null) {
    return (
      <div data-testid="audience-join-modal-qr-error" role="alert">
        Failed to render QR code: {error}
      </div>
    );
  }
  if (dataUrl === null) {
    return <div data-testid="audience-join-modal-qr-pending">Generating QR…</div>;
  }
  return (
    <img
      data-testid="audience-join-modal-qr"
      src={dataUrl}
      alt={`Voter QR code for ${voterUrl}`}
      width={256}
      height={256}
    />
  );
}
