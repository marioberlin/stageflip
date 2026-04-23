// apps/stageflip-slide/src/components/dialogs/import/google-slides-import.tsx
// Google Slides import dialog (T-139b).

/**
 * Two-field form — OAuth access token + deck ID — that dispatches a
 * converter call on submit. The real OAuth backend isn't wired yet;
 * this dialog runs in legacy-bridge mode: the caller supplies a
 * `onFetchDeck(token, deckId)` callback, typically pointing at
 * `@stageflip/import-slidemotion-legacy`'s `importLegacyDocument`
 * wrapped over a `fetch` that calls the Google Slides API.
 *
 * Feature-flag banner tells the user the OAuth side is pending so the
 * dialog doesn't pretend to be a finished product.
 */

'use client';

import { t } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { ModalShell } from '../modal-shell';

export interface GoogleSlidesImportProps {
  open: boolean;
  onClose: () => void;
  /**
   * Fetch-and-convert callback. Returns a `Document` on success or
   * throws. The callback is responsible for wiring fetch + converter —
   * keeps this component free of network plumbing + trivially testable.
   */
  onFetchDeck: (token: string, deckId: string) => Promise<Document>;
  /** Invoked with the converted document on success. */
  onImported: (doc: Document) => void;
}

type FormState = 'idle' | 'pending' | 'error';

export function GoogleSlidesImport({
  open,
  onClose,
  onFetchDeck,
  onImported,
}: GoogleSlidesImportProps): ReactElement {
  const [token, setToken] = useState('');
  const [deckId, setDeckId] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const reset = useCallback((): void => {
    setToken('');
    setDeckId('');
    setState('idle');
    setErrorKey(null);
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!token.trim() || !deckId.trim()) {
        setState('error');
        setErrorKey('import.google.error.missingFields');
        return;
      }
      setState('pending');
      setErrorKey(null);
      try {
        const doc = await onFetchDeck(token.trim(), deckId.trim());
        onImported(doc);
        reset();
        onClose();
      } catch {
        setState('error');
        setErrorKey('import.google.error.generic');
      }
    },
    [token, deckId, onFetchDeck, onImported, onClose, reset],
  );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={t('import.google.title')}
      testIdSuffix="import-google"
    >
      <p data-testid="import-google-feature-flag" style={bannerStyle}>
        {t('import.google.featureFlag')}
      </p>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle} htmlFor="import-google-token">
          {t('import.google.tokenLabel')}
        </label>
        <input
          id="import-google-token"
          data-testid="import-google-token"
          type="text"
          value={token}
          placeholder={t('import.google.tokenPlaceholder')}
          onChange={(e) => setToken(e.target.value)}
          style={inputStyle}
        />
        <label style={labelStyle} htmlFor="import-google-deck-id">
          {t('import.google.deckIdLabel')}
        </label>
        <input
          id="import-google-deck-id"
          data-testid="import-google-deck-id"
          type="text"
          value={deckId}
          placeholder={t('import.google.deckIdPlaceholder')}
          onChange={(e) => setDeckId(e.target.value)}
          style={inputStyle}
        />
        {errorKey ? (
          <p data-testid="import-google-error" style={errorStyle}>
            {t(errorKey)}
          </p>
        ) : null}
        <div style={footerStyle}>
          <button
            type="button"
            data-testid="import-google-cancel"
            onClick={handleClose}
            style={secondaryBtnStyle}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            data-testid="import-google-submit"
            disabled={state === 'pending'}
            style={primaryBtnStyle(state === 'pending')}
          >
            {state === 'pending' ? t('import.google.pending') : t('import.google.submit')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

const bannerStyle: CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(90, 248, 251, 0.08)',
  border: '1px solid rgba(90, 248, 251, 0.2)',
  borderRadius: 6,
  color: '#5af8fb',
  fontSize: 11,
  margin: '0 0 16px 0',
};

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#a5acb4',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const inputStyle: CSSProperties = {
  padding: '8px 10px',
  background: 'rgba(8, 15, 21, 0.6)',
  color: '#ebf1fa',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'monospace',
};

const errorStyle: CSSProperties = {
  padding: '6px 10px',
  background: 'rgba(255, 138, 138, 0.1)',
  color: '#ff8a8a',
  border: '1px solid rgba(255, 138, 138, 0.3)',
  borderRadius: 6,
  fontSize: 12,
  margin: 0,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 12,
};

const secondaryBtnStyle: CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  color: '#a5acb4',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};

function primaryBtnStyle(disabled: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    background: disabled ? 'rgba(129, 174, 255, 0.06)' : 'rgba(129, 174, 255, 0.15)',
    color: disabled ? '#5a6068' : '#5af8fb',
    border: `1px solid ${disabled ? 'rgba(90, 248, 251, 0.12)' : 'rgba(90, 248, 251, 0.4)'}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
