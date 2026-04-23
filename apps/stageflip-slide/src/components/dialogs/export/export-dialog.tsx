// apps/stageflip-slide/src/components/dialogs/export/export-dialog.tsx
// Export dialog — resolution + format + range (T-139b).

/**
 * The editor-visible face of the renderer-cdp export pipeline. Three
 * controls: format (PNG / MP4), resolution (1080p / 720p / 4K), range
 * (full deck / current slide). On submit, dispatches the pure
 * `ExportRequest` via the injected `onExport` callback — the wiring
 * to `exportDocument` from `@stageflip/renderer-cdp` lives in the
 * parent composer so tests can stub without standing up Puppeteer.
 *
 * The dialog reflects the document atom via `useDocument()`; the
 * submit button is disabled when the document is unhydrated.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { ModalShell } from '../modal-shell';

export type ExportFormat = 'png' | 'mp4';
export type ExportResolution = '720' | '1080' | '4k';
export type ExportRange = 'all' | 'current';

export interface ExportRequest {
  format: ExportFormat;
  resolution: ExportResolution;
  range: ExportRange;
}

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Dispatch a configured export. Parent composer is responsible for
   * translating `ExportRequest` → `@stageflip/renderer-cdp`
   * `exportDocument({ ... })` call. Returns a promise so the dialog
   * can render a pending state.
   */
  onExport: (request: ExportRequest) => Promise<void>;
}

type FormState = 'idle' | 'pending' | 'error';

export function ExportDialog({ open, onClose, onExport }: ExportDialogProps): ReactElement {
  const { document } = useDocument();
  const [format, setFormat] = useState<ExportFormat>('png');
  const [resolution, setResolution] = useState<ExportResolution>('1080');
  const [range, setRange] = useState<ExportRange>('all');
  const [state, setState] = useState<FormState>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleClose = useCallback((): void => {
    setState('idle');
    setErrorKey(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (document === null) {
        setState('error');
        setErrorKey('export.dialog.error.noDocument');
        return;
      }
      setState('pending');
      try {
        await onExport({ format, resolution, range });
        setState('idle');
        onClose();
      } catch {
        setState('error');
        setErrorKey('export.dialog.error.noDocument');
      }
    },
    [document, format, resolution, range, onExport, onClose],
  );

  const disabled = state === 'pending' || document === null;

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={t('export.dialog.title')}
      testIdSuffix="export"
    >
      <form onSubmit={handleSubmit} style={formStyle}>
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>{t('export.dialog.formatLabel')}</legend>
          <RadioGroup
            name="export-format"
            value={format}
            onChange={(v) => setFormat(v as ExportFormat)}
            options={[
              { value: 'png', label: t('export.dialog.format.png'), testId: 'export-format-png' },
              { value: 'mp4', label: t('export.dialog.format.mp4'), testId: 'export-format-mp4' },
            ]}
          />
        </fieldset>
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>{t('export.dialog.resolutionLabel')}</legend>
          <RadioGroup
            name="export-resolution"
            value={resolution}
            onChange={(v) => setResolution(v as ExportResolution)}
            options={[
              {
                value: '1080',
                label: t('export.dialog.resolution.1080'),
                testId: 'export-resolution-1080',
              },
              {
                value: '720',
                label: t('export.dialog.resolution.720'),
                testId: 'export-resolution-720',
              },
              {
                value: '4k',
                label: t('export.dialog.resolution.4k'),
                testId: 'export-resolution-4k',
              },
            ]}
          />
        </fieldset>
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>{t('export.dialog.rangeLabel')}</legend>
          <RadioGroup
            name="export-range"
            value={range}
            onChange={(v) => setRange(v as ExportRange)}
            options={[
              { value: 'all', label: t('export.dialog.range.all'), testId: 'export-range-all' },
              {
                value: 'current',
                label: t('export.dialog.range.current'),
                testId: 'export-range-current',
              },
            ]}
          />
        </fieldset>
        {errorKey ? (
          <p data-testid="export-error" style={errorStyle}>
            {t(errorKey)}
          </p>
        ) : null}
        <div style={footerStyle}>
          <button
            type="button"
            data-testid="export-cancel"
            onClick={handleClose}
            style={secondaryBtnStyle}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            data-testid="export-submit"
            disabled={disabled}
            style={primaryBtnStyle(disabled)}
          >
            {state === 'pending' ? t('export.dialog.pending') : t('export.dialog.submit')}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface RadioOption {
  value: string;
  label: string;
  testId: string;
}

function RadioGroup({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<RadioOption>;
}): ReactElement {
  return (
    <div style={radioGroupStyle}>
      {options.map((opt) => (
        <label key={opt.value} style={radioLabelStyle}>
          <input
            type="radio"
            data-testid={opt.testId}
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

const formStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const fieldsetStyle: CSSProperties = {
  border: '1px solid rgba(129, 174, 255, 0.1)',
  borderRadius: 8,
  padding: '8px 12px 10px 12px',
  margin: 0,
};
const legendStyle: CSSProperties = {
  padding: '0 6px',
  fontSize: 11,
  fontWeight: 600,
  color: '#a5acb4',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};
const radioGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const radioLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  cursor: 'pointer',
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
