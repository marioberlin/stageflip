// apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/loss-flag-row.tsx
// Per-flag row in the T-248 loss-flag reporter. Pure: receives the
// `LossFlag` and callbacks via props; owns no atom subscriptions.

'use client';

import { t } from '@stageflip/editor-shell';
import type { LossFlag } from '@stageflip/loss-flags';
import type { CSSProperties, ReactElement } from 'react';

export interface LossFlagRowProps {
  flag: LossFlag;
  onDismiss: (id: string) => void;
  onLocate: (flag: LossFlag) => void;
  /**
   * True when the flag's `location.slideId` (and `elementId`, when
   * present) resolves against the current document. Drives the locate
   * button's `aria-disabled` state per AC #18.
   */
  locateAvailable: boolean;
}

const SEVERITY_GLYPH: Readonly<Record<LossFlag['severity'], string>> = {
  info: 'i',
  warn: '!',
  error: '×',
};

export function LossFlagRow({
  flag,
  onDismiss,
  onLocate,
  locateAvailable,
}: LossFlagRowProps): ReactElement {
  const handleLocateClick = (): void => {
    if (!locateAvailable) return;
    onLocate(flag);
  };

  return (
    <div data-testid="loss-flag-row" data-severity={flag.severity} style={rowStyle}>
      <span aria-hidden="true" data-testid="loss-flag-row-severity" style={glyphStyle}>
        {SEVERITY_GLYPH[flag.severity]}
      </span>
      <div style={bodyStyle}>
        <div style={headerLineStyle}>
          <span data-testid="loss-flag-row-source" style={sourceBadgeStyle}>
            {t('lossFlags.row.source')}: {flag.source}
          </span>
          <code data-testid="loss-flag-row-code" style={codeStyle}>
            {flag.code}
          </code>
        </div>
        <p data-testid="loss-flag-row-message" style={messageStyle}>
          {flag.message}
        </p>
        {flag.recovery ? (
          <p data-testid="loss-flag-row-recovery" style={recoveryStyle}>
            {flag.recovery}
          </p>
        ) : null}
      </div>
      <div style={actionsStyle}>
        <button
          type="button"
          data-testid="loss-flag-row-locate"
          aria-disabled={locateAvailable ? undefined : 'true'}
          aria-label={t('lossFlags.row.locate')}
          title={
            locateAvailable
              ? t('lossFlags.row.locate')
              : t('lossFlags.row.locateUnavailable')
          }
          onClick={handleLocateClick}
          style={locateBtnStyle(locateAvailable)}
        >
          {t('lossFlags.row.locate')}
        </button>
        <button
          type="button"
          data-testid="loss-flag-row-dismiss"
          aria-label={t('lossFlags.row.dismiss')}
          onClick={() => onDismiss(flag.id)}
          style={dismissBtnStyle}
        >
          {t('lossFlags.row.dismiss')}
        </button>
      </div>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '8px 10px',
  borderBottom: '1px solid rgba(165, 172, 180, 0.08)',
  alignItems: 'flex-start',
};

const glyphStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  fontSize: 11,
  fontWeight: 700,
  color: '#ebf1fa',
  background: 'rgba(129, 174, 255, 0.15)',
  flexShrink: 0,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const headerLineStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const sourceBadgeStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#a5acb4',
};

const codeStyle: CSSProperties = {
  fontSize: 11,
  fontFamily: 'monospace',
  color: '#5af8fb',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#ebf1fa',
};

const recoveryStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: '#a5acb4',
  fontStyle: 'italic',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexShrink: 0,
};

function locateBtnStyle(enabled: boolean): CSSProperties {
  return {
    padding: '4px 8px',
    background: 'transparent',
    color: enabled ? '#5af8fb' : '#5a6068',
    border: `1px solid ${enabled ? 'rgba(90, 248, 251, 0.3)' : 'rgba(90, 248, 251, 0.08)'}`,
    borderRadius: 4,
    fontSize: 11,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const dismissBtnStyle: CSSProperties = {
  padding: '4px 8px',
  background: 'transparent',
  color: '#a5acb4',
  border: '1px solid rgba(165, 172, 180, 0.2)',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};
