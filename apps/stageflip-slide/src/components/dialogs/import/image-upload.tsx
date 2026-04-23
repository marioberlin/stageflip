// apps/stageflip-slide/src/components/dialogs/import/image-upload.tsx
// Image upload dialog (T-139b).

/**
 * File picker that appends the picked image to `assetsAtom` via
 * `addAssetAtom`. Validates mime-type (image/*) and an upload-size cap
 * (20 MB). The asset's URL is a `blob:` object URL created locally —
 * no server round trip, no storage yet. A future persistence task can
 * swap the local URL for an uploaded CDN URL without touching the
 * dialog.
 */

'use client';

import { addAssetAtom, t, useEditorShellSetAtom } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useRef, useState } from 'react';
import { ModalShell } from '../modal-shell';

export interface ImageUploadProps {
  open: boolean;
  onClose: () => void;
  /**
   * Optional object-URL factory so tests can inject a deterministic
   * stand-in for `URL.createObjectURL`. Defaults to the global.
   */
  createObjectUrl?: (file: Blob) => string;
  /**
   * Optional id factory. Defaults to a deterministic `asset-<random>`
   * using `crypto.randomUUID` when available or `Math.random` as a
   * fallback. Editor-shell is outside the determinism-restricted scope
   * so wall-clock / random values are allowed here.
   */
  makeId?: () => string;
}

const MAX_BYTES = 20 * 1024 * 1024;

export function ImageUpload({
  open,
  onClose,
  createObjectUrl,
  makeId,
}: ImageUploadProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const addAsset = useEditorShellSetAtom(addAssetAtom);

  const reset = useCallback((): void => {
    setFile(null);
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
    if (!picked.type.startsWith('image/')) {
      setFile(null);
      setErrorKey('import.image.error.invalidType');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setErrorKey('import.image.error.tooLarge');
      return;
    }
    setFile(picked);
    setErrorKey(null);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      if (!file) return;
      const toUrl = createObjectUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
      const toId =
        makeId ??
        ((): string => {
          const g: unknown = globalThis;
          const c = (g as { crypto?: { randomUUID?: () => string } }).crypto;
          if (c?.randomUUID) return `asset-${c.randomUUID()}`;
          return `asset-${Math.random().toString(36).slice(2)}`;
        });
      const id = toId();
      addAsset({
        id,
        kind: 'image',
        name: file.name,
        url: toUrl(file),
        sizeBytes: file.size,
        addedAt: Date.now(),
      });
      reset();
      onClose();
    },
    [file, addAsset, createObjectUrl, makeId, reset, onClose],
  );

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={t('import.image.title')}
      testIdSuffix="import-image"
    >
      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle} htmlFor="import-image-file">
          {t('import.image.pickLabel')}
        </label>
        <input
          id="import-image-file"
          data-testid="import-image-file"
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={inputStyle}
        />
        {errorKey ? (
          <p data-testid="import-image-error" style={errorStyle}>
            {t(errorKey)}
          </p>
        ) : null}
        <div style={footerStyle}>
          <button
            type="button"
            data-testid="import-image-cancel"
            onClick={handleClose}
            style={secondaryBtnStyle}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            data-testid="import-image-submit"
            disabled={file === null}
            style={primaryBtnStyle(file === null)}
          >
            {t('import.image.submit')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

const formStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#a5acb4',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};
const inputStyle: CSSProperties = { padding: '6px 0', color: '#ebf1fa', fontSize: 12 };
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
