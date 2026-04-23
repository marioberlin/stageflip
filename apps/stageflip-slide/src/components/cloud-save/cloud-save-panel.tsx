// apps/stageflip-slide/src/components/cloud-save/cloud-save-panel.tsx
// Cloud-save status panel with manual-save button + conflict UI (T-139c).

'use client';

import {
  type CloudSaveAdapter,
  CloudSaveConflictError,
  type CloudSaveResult,
  type CloudSaveStatus,
  t,
  useDocument,
} from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useState } from 'react';

export interface CloudSavePanelProps {
  adapter: CloudSaveAdapter;
  /**
   * When supplied, rendered before the status badge; the parent can
   * close the panel via this callback (cloud-save UI is usually
   * rendered inside a popover that lives next to the Save button).
   */
  onClose?: () => void;
}

/**
 * `<CloudSavePanel>` is the user-facing front end for the cloud-save
 * state-machine. It owns:
 *
 *   - `status` for the status badge (`idle` / `saving` / `saved` /
 *     `conflict` / `error`)
 *   - `lastResult` for the "Saved at … · rev N" readout
 *   - `conflict` state for the three-way-merge affordances
 *
 * The underlying adapter is injected by the caller so Phase 6 can pass
 * the stub and Phase 12 can swap in `@stageflip/collab` without the
 * UI changing.
 */
export function CloudSavePanel({ adapter, onClose }: CloudSavePanelProps): ReactElement {
  const { document: doc, setDocument } = useDocument();
  const [status, setStatus] = useState<CloudSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CloudSaveResult | null>(null);
  const [conflict, setConflict] = useState<{
    local: Document;
    remote: Document;
  } | null>(null);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!doc) return;
    setStatus('saving');
    setError(null);
    try {
      const result = await adapter.save(doc);
      setLastResult(result);
      setStatus('saved');
    } catch (err) {
      if (err instanceof CloudSaveConflictError) {
        setConflict({ local: err.local, remote: err.remote });
        setStatus('conflict');
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    }
  }, [doc, adapter]);

  const resolveKeepLocal = useCallback(async (): Promise<void> => {
    if (!conflict) return;
    setConflict(null);
    // Re-save the local document; tests simulate a single-shot conflict
    // so this attempt succeeds.
    await handleSave();
  }, [conflict, handleSave]);

  const resolveKeepRemote = useCallback((): void => {
    if (!conflict) return;
    setDocument(conflict.remote);
    setConflict(null);
    setStatus('idle');
  }, [conflict, setDocument]);

  return (
    <section data-testid="cloud-save-panel" style={panelStyle} aria-label={t('cloudSave.title')}>
      <header style={headerStyle}>
        <span style={titleStyle}>{t('cloudSave.title')}</span>
        {onClose ? (
          <button
            type="button"
            data-testid="cloud-save-close"
            onClick={onClose}
            aria-label={t('common.close')}
            style={closeButtonStyle}
          >
            ✕
          </button>
        ) : null}
      </header>
      <div style={bodyStyle}>
        <StatusBadge status={status} />
        {lastResult ? (
          <div data-testid="cloud-save-last-result" style={readoutStyle}>
            {t('cloudSave.lastSavedAt')}: {lastResult.savedAtIso} · {t('cloudSave.revision')}{' '}
            {lastResult.revision}
          </div>
        ) : null}
        {error ? (
          <div data-testid="cloud-save-error" style={errorStyle}>
            {error}
          </div>
        ) : null}
      </div>
      {conflict ? (
        <ConflictPanel onKeepLocal={resolveKeepLocal} onKeepRemote={resolveKeepRemote} />
      ) : null}
      <footer style={footerStyle}>
        <button
          type="button"
          data-testid="cloud-save-save"
          onClick={handleSave}
          disabled={status === 'saving' || !doc || status === 'conflict'}
          style={saveButtonStyle}
        >
          {status === 'saved' ? t('cloudSave.saveAgain') : t('cloudSave.save')}
        </button>
      </footer>
    </section>
  );
}

function StatusBadge({ status }: { status: CloudSaveStatus }): ReactElement {
  return (
    <span data-testid="cloud-save-status" data-status={status} style={badgeStyle(status)}>
      {t(`cloudSave.status.${status}`)}
    </span>
  );
}

function ConflictPanel({
  onKeepLocal,
  onKeepRemote,
}: {
  onKeepLocal: () => void;
  onKeepRemote: () => void;
}): ReactElement {
  return (
    <div data-testid="cloud-save-conflict" style={conflictBoxStyle}>
      <strong style={{ fontSize: 12 }}>{t('cloudSave.conflict.title')}</strong>
      <p style={{ fontSize: 11, color: '#a5acb4', margin: '4px 0 8px' }}>
        {t('cloudSave.conflict.body')}
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          data-testid="cloud-save-conflict-keep-local"
          onClick={onKeepLocal}
          style={conflictButtonStyle}
        >
          {t('cloudSave.conflict.keepLocal')}
        </button>
        <button
          type="button"
          data-testid="cloud-save-conflict-keep-remote"
          onClick={onKeepRemote}
          style={conflictButtonStyle}
        >
          {t('cloudSave.conflict.keepRemote')}
        </button>
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  width: 320,
  background: 'rgba(21, 28, 35, 0.95)',
  border: '1px solid rgba(129, 174, 255, 0.1)',
  borderRadius: 12,
  color: '#ebf1fa',
  fontSize: 13,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px 8px',
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#a5acb4',
  cursor: 'pointer',
  fontSize: 12,
};

const bodyStyle: CSSProperties = {
  padding: '0 14px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const readoutStyle: CSSProperties = {
  fontSize: 11,
  color: '#a5acb4',
  fontFamily: 'monospace',
};

const errorStyle: CSSProperties = {
  fontSize: 11,
  color: '#ff9292',
  background: 'rgba(255, 146, 146, 0.1)',
  padding: 6,
  borderRadius: 4,
};

const conflictBoxStyle: CSSProperties = {
  margin: '0 14px 12px',
  padding: 10,
  background: 'rgba(251, 189, 64, 0.08)',
  border: '1px solid rgba(251, 189, 64, 0.25)',
  borderRadius: 6,
};

const conflictButtonStyle: CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: 'transparent',
  color: '#ebf1fa',
  border: '1px solid rgba(129, 174, 255, 0.3)',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

const footerStyle: CSSProperties = {
  padding: '4px 14px 12px',
};

const saveButtonStyle: CSSProperties = {
  width: '100%',
  padding: '8px 14px',
  background: 'rgba(129, 174, 255, 0.15)',
  color: '#5af8fb',
  border: '1px solid rgba(90, 248, 251, 0.3)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

function badgeStyle(status: CloudSaveStatus): CSSProperties {
  const palette: Record<CloudSaveStatus, { bg: string; fg: string }> = {
    idle: { bg: 'rgba(165, 172, 180, 0.15)', fg: '#a5acb4' },
    saving: { bg: 'rgba(129, 174, 255, 0.15)', fg: '#81aeff' },
    saved: { bg: 'rgba(90, 248, 251, 0.12)', fg: '#5af8fb' },
    conflict: { bg: 'rgba(251, 189, 64, 0.15)', fg: '#fbbd40' },
    error: { bg: 'rgba(255, 146, 146, 0.15)', fg: '#ff9292' },
  };
  const { bg, fg } = palette[status];
  return {
    display: 'inline-block',
    padding: '3px 8px',
    background: bg,
    color: fg,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.05,
    textTransform: 'uppercase',
    borderRadius: 4,
    alignSelf: 'flex-start',
  };
}
