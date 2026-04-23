// apps/stageflip-slide/src/components/dialogs/import/pptx-import.tsx
// PPTX import dialog (T-139b) — stub.

/**
 * The file picker validates a `.pptx` mime-type + extension and
 * dispatches a parse callback. A full PPTX parser ships in a follow-up
 * task — landing the real parser inside T-139b would balloon scope
 * (license review + OOXML traversal + image-extraction pipeline) past
 * the row's M estimate. The stub banner is visible in the dialog.
 *
 * The component is still tests-first + i18n-clean so a later task can
 * swap in the real parser behind the same `onImport` seam without
 * touching consumers.
 */

'use client';

import { t } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';
import { ModalShell } from '../modal-shell';

export interface PptxImportProps {
  open: boolean;
  onClose: () => void;
  /**
   * Parse callback. Runs against a user-picked `.pptx` `File`. The stub
   * implementation may simply record the call and no-op; a follow-up
   * task will wire a real converter.
   */
  onImport: (file: File) => Promise<void>;
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type FormState = 'idle' | 'pending' | 'error';

export function PptxImport({ open, onClose, onImport }: PptxImportProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<FormState>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const reset = useCallback((): void => {
    setFile(null);
    setState('idle');
    setErrorKey(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const picked = event.target.files?.[0];
    if (!picked) {
      setFile(null);
      return;
    }
    const looksLikePptx = picked.type === PPTX_MIME || picked.name.toLowerCase().endsWith('.pptx');
    if (!looksLikePptx) {
      setFile(null);
      setState('error');
      setErrorKey('import.pptx.error.invalidType');
      return;
    }
    setFile(picked);
    setState('idle');
    setErrorKey(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!file) return;
      setState('pending');
      try {
        await onImport(file);
        reset();
        onClose();
      } catch {
        setState('error');
        setErrorKey('import.pptx.error.invalidType');
      }
    },
    [file, onImport, onClose, reset],
  );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={t('import.pptx.title')}
      testIdSuffix="import-pptx"
    >
      <p data-testid="import-pptx-stub-banner" style={bannerStyle}>
        {t('import.pptx.stub')}
      </p>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle} htmlFor="import-pptx-file">
          {t('import.pptx.pickLabel')}
        </label>
        <input
          id="import-pptx-file"
          data-testid="import-pptx-file"
          ref={inputRef}
          type="file"
          accept=".pptx"
          onChange={handleFileChange}
          style={inputStyle}
        />
        {errorKey ? (
          <p data-testid="import-pptx-error" style={errorStyle}>
            {t(errorKey)}
          </p>
        ) : null}
        <div style={footerStyle}>
          <button
            type="button"
            data-testid="import-pptx-cancel"
            onClick={handleClose}
            style={secondaryBtnStyle}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            data-testid="import-pptx-submit"
            disabled={file === null || state === 'pending'}
            style={primaryBtnStyle(file === null || state === 'pending')}
          >
            {t('import.pptx.submit')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

const bannerStyle: CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(255, 191, 100, 0.08)',
  border: '1px solid rgba(255, 191, 100, 0.3)',
  borderRadius: 6,
  color: '#ffbf64',
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
  padding: '6px 0',
  color: '#ebf1fa',
  fontSize: 12,
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
