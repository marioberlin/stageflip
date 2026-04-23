// apps/stageflip-slide/src/components/dialogs/modal-shell.tsx
// Shared modal chrome for T-139b import + export dialogs.

/**
 * A deliberately thin dialog shell: glass-panel chrome, centered in
 * the viewport, Escape-to-close, click-outside-to-close. Does not
 * manage its own open/closed state — the parent owns `open` + `onClose`.
 *
 * All three import dialogs and the export dialog compose this shell
 * to keep visual consistency without a dedicated modal-kit.
 */

'use client';

import { t } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export interface ModalShellProps {
  /** When false, the modal is not mounted. */
  open: boolean;
  /** Called when the user presses Escape or clicks the backdrop. */
  onClose: () => void;
  /** i18n key or plain string resolved by the caller via `t()`. */
  title: string;
  /** Stable testid suffix, e.g. `import-google`. */
  testIdSuffix: string;
  children: ReactNode;
}

/**
 * Centered dialog chrome. Returns `null` when closed so the component
 * stays cheap when idle.
 */
export function ModalShell({
  open,
  onClose,
  title,
  testIdSuffix,
  children,
}: ModalShellProps): ReactElement | null {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const handleBackdropKey = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };
  return (
    <div
      data-testid={`modal-${testIdSuffix}`}
      // biome-ignore lint/a11y/useSemanticElements: Native <dialog> requires imperative showModal()/close() calls that do not compose cleanly with the declarative open/onClose prop contract this shell exposes. role="dialog" + aria-modal="true" supply the same a11y surface.
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={backdropStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={handleBackdropKey}
    >
      <div ref={panelRef} style={panelStyle}>
        <header style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button
            type="button"
            data-testid={`modal-${testIdSuffix}-close`}
            aria-label={t('common.close')}
            onClick={onClose}
            style={closeBtnStyle}
          >
            ×
          </button>
        </header>
        <div style={bodyStyle}>{children}</div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(8, 15, 21, 0.6)',
  backdropFilter: 'blur(8px)',
  zIndex: 500,
};

const panelStyle: CSSProperties = {
  width: 'min(480px, 90vw)',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(21, 28, 35, 0.92)',
  borderRadius: 12,
  border: '1px solid rgba(129, 174, 255, 0.15)',
  boxShadow: '0 24px 96px rgba(0, 114, 229, 0.16)',
  color: '#ebf1fa',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(165, 172, 180, 0.1)',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
};

const closeBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  background: 'transparent',
  color: '#a5acb4',
  border: 'none',
  borderRadius: 6,
  fontSize: 20,
  lineHeight: '28px',
  cursor: 'pointer',
};

const bodyStyle: CSSProperties = {
  padding: 20,
  overflowY: 'auto',
};
