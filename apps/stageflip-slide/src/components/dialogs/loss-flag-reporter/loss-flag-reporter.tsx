// apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/loss-flag-reporter.tsx
// T-248 reporter modal: lists every visible loss flag, grouped by
// severity. Per-row dismiss + bulk dismiss + click-to-locate (writes
// `activeSlideIdAtom` + `selectedElementIdsAtom`).

'use client';

import {
  EMPTY_SELECTION,
  activeSlideIdAtom,
  dismissedLossFlagIdsAtom,
  documentAtom,
  importLossFlagsAtom,
  selectedElementIdsAtom,
  t,
  useEditorShellAtomValue,
  useEditorShellSetAtom,
  visibleLossFlagsAtom,
} from '@stageflip/editor-shell';
import type { LossFlag } from '@stageflip/loss-flags';
import type { Document } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { ModalShell } from '../modal-shell';
import { LossFlagRow } from './loss-flag-row';

export interface LossFlagReporterProps {
  open: boolean;
  onClose: () => void;
}

const SEVERITY_ORDER: ReadonlyArray<LossFlag['severity']> = ['error', 'warn', 'info'];

function flagsBySeverity(
  flags: readonly LossFlag[],
): ReadonlyMap<LossFlag['severity'], readonly LossFlag[]> {
  const out = new Map<LossFlag['severity'], LossFlag[]>();
  for (const sev of SEVERITY_ORDER) out.set(sev, []);
  for (const f of flags) {
    const bucket = out.get(f.severity);
    if (bucket) bucket.push(f);
  }
  return out;
}

function locateAvailable(flag: LossFlag, document: Document | null): boolean {
  const slideId = flag.location.slideId;
  if (!slideId) return false;
  if (!document || document.content.mode !== 'slide') return false;
  return document.content.slides.some((s) => s.id === slideId);
}

export function LossFlagReporter({ open, onClose }: LossFlagReporterProps): ReactElement {
  const visible = useEditorShellAtomValue(visibleLossFlagsAtom);
  const allFlags = useEditorShellAtomValue(importLossFlagsAtom);
  const document = useEditorShellAtomValue(documentAtom);
  const setDismissed = useEditorShellSetAtom(dismissedLossFlagIdsAtom);
  const setActiveSlide = useEditorShellSetAtom(activeSlideIdAtom);
  const setSelectedElementIds = useEditorShellSetAtom(selectedElementIdsAtom);

  const handleDismiss = (id: string): void => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleDismissAll = (): void => {
    setDismissed(new Set(allFlags.map((f) => f.id)));
  };

  const handleLocate = (flag: LossFlag): void => {
    const slideId = flag.location.slideId;
    if (slideId && locateAvailable(flag, document)) {
      setActiveSlide(slideId);
      const elementId = flag.location.elementId;
      if (
        elementId &&
        document?.content.mode === 'slide' &&
        document.content.slides
          .find((s) => s.id === slideId)
          ?.elements.some((el) => el.id === elementId)
      ) {
        setSelectedElementIds(new Set([elementId]));
      } else {
        setSelectedElementIds(EMPTY_SELECTION);
      }
    }
    onClose();
  };

  const grouped = flagsBySeverity(visible);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('lossFlags.modal.title')}
      testIdSuffix="loss-flag-reporter"
    >
      {visible.length === 0 ? (
        <p data-testid="loss-flag-reporter-empty" style={emptyStyle}>
          {t('lossFlags.modal.empty')}
        </p>
      ) : (
        <>
          <p data-testid="loss-flag-reporter-subtitle" style={subtitleStyle}>
            {t('lossFlags.modal.subtitle').replace('{n}', String(visible.length))}
          </p>
          {SEVERITY_ORDER.map((severity) => {
            const bucket = grouped.get(severity) ?? [];
            if (bucket.length === 0) return null;
            return (
              <section
                key={severity}
                data-testid={`loss-flag-reporter-group-${severity}`}
                data-severity={severity}
                style={groupStyle}
              >
                <h3 style={groupHeaderStyle}>
                  {t(`lossFlags.severity.${severity}`)} ({bucket.length})
                </h3>
                {bucket.map((flag) => (
                  <LossFlagRow
                    key={flag.id}
                    flag={flag}
                    onDismiss={handleDismiss}
                    onLocate={handleLocate}
                    locateAvailable={locateAvailable(flag, document)}
                  />
                ))}
              </section>
            );
          })}
          <div style={footerStyle}>
            <button
              type="button"
              data-testid="loss-flag-reporter-dismiss-all"
              onClick={handleDismissAll}
              style={dismissAllBtnStyle}
            >
              {t('lossFlags.modal.dismissAll')}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

const emptyStyle: CSSProperties = {
  margin: 0,
  padding: '12px 0',
  color: '#a5acb4',
  fontSize: 12,
  textAlign: 'center',
};

const subtitleStyle: CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: 11,
  color: '#a5acb4',
};

const groupStyle: CSSProperties = {
  marginBottom: 12,
};

const groupHeaderStyle: CSSProperties = {
  margin: '0 0 4px 0',
  padding: '4px 0',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#a5acb4',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 12,
};

const dismissAllBtnStyle: CSSProperties = {
  padding: '6px 14px',
  background: 'transparent',
  color: '#a5acb4',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
