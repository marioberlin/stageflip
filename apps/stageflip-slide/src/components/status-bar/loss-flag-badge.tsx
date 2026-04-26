// apps/stageflip-slide/src/components/status-bar/loss-flag-badge.tsx
// Status-bar badge for the T-248 loss-flag reporter. Reads the editor-
// shell `visibleLossFlagsAtom`; when non-empty, renders a button labelled
// with the flag count + the worst-severity color. Clicking opens the
// reporter modal.

'use client';

import { t, useEditorShellAtomValue, visibleLossFlagsAtom } from '@stageflip/editor-shell';
import type { LossFlag } from '@stageflip/loss-flags';
import type { CSSProperties, ReactElement } from 'react';
import { useState } from 'react';
import { LossFlagReporter } from '../dialogs/loss-flag-reporter/loss-flag-reporter';

const SEVERITY_RANK: Readonly<Record<LossFlag['severity'], number>> = {
  error: 0,
  warn: 1,
  info: 2,
};

function worstSeverity(flags: readonly LossFlag[]): LossFlag['severity'] {
  let worst: LossFlag['severity'] = 'info';
  for (const f of flags) {
    if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[worst]) worst = f.severity;
  }
  return worst;
}

/** Severity → palette tokens. Reuses the in-app accent (~#5af8fb) for
 * info, the import-banner amber for warn, and the existing error red for
 * error — no new tokens introduced. */
const SEVERITY_STYLE: Readonly<Record<LossFlag['severity'], CSSProperties>> = {
  info: {
    color: '#5af8fb',
    background: 'rgba(90, 248, 251, 0.08)',
    border: '1px solid rgba(90, 248, 251, 0.3)',
  },
  warn: {
    color: '#ffbf64',
    background: 'rgba(255, 191, 100, 0.08)',
    border: '1px solid rgba(255, 191, 100, 0.3)',
  },
  error: {
    color: '#ff8a8a',
    background: 'rgba(255, 138, 138, 0.1)',
    border: '1px solid rgba(255, 138, 138, 0.3)',
  },
};

/**
 * Renders nothing when there are no visible flags (AC #6); otherwise a
 * small button that opens the reporter modal.
 */
export function LossFlagBadge(): ReactElement | null {
  const flags = useEditorShellAtomValue(visibleLossFlagsAtom);
  const [open, setOpen] = useState(false);

  if (flags.length === 0) return null;

  const severity = worstSeverity(flags);
  const label = t('lossFlags.badge.title');

  return (
    <>
      <button
        type="button"
        data-testid="loss-flag-badge"
        data-severity={severity}
        aria-label={`${label} (${flags.length})`}
        title={label}
        onClick={() => setOpen(true)}
        style={{ ...baseStyle, ...SEVERITY_STYLE[severity] }}
      >
        <span aria-hidden="true">⚑</span>
        <span data-testid="loss-flag-badge-count">{flags.length}</span>
      </button>
      <LossFlagReporter open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  marginLeft: 'auto',
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};
