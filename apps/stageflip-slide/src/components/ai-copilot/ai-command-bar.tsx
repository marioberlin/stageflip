// apps/stageflip-slide/src/components/ai-copilot/ai-command-bar.tsx
// Header strip inside the AI copilot sidebar: title + status + close.

/**
 * Phase 6 stub. The command bar has three jobs the real copilot will keep:
 *   - announce which agent layer (planner / executor / validator) is
 *     currently active — today we only surface idle / pending / error.
 *   - offer a close affordance that matches `<AiCopilot>`'s Esc handler.
 *   - act as the drag handle when the copilot is torn off into a floating
 *     panel (Phase 7). Not implemented here; reserved via a `draggable`
 *     attribute hook at the root so the DOM shape doesn't change later.
 *
 * Status strings come from the shared editor-shell catalog so pseudo-locale
 * QA highlights every `copilot.*` key at once.
 */

'use client';

import { t } from '@stageflip/editor-shell';
import type { ReactElement } from 'react';

export type AiStatus = 'idle' | 'pending' | 'error';

export interface AiCommandBarProps {
  status: AiStatus;
  onClose: () => void;
}

export function AiCommandBar({ status, onClose }: AiCommandBarProps): ReactElement {
  return (
    <header data-testid="ai-command-bar" data-status={status} style={headerStyle}>
      <span style={titleStyle}>{t('copilot.title')}</span>
      <span data-testid="ai-command-bar-status" style={statusStyle(status)}>
        {t(statusKey(status))}
      </span>
      <button
        type="button"
        data-testid="ai-command-bar-close"
        onClick={onClose}
        aria-label={t('copilot.close')}
        style={closeButtonStyle}
      >
        ×
      </button>
    </header>
  );
}

function statusKey(status: AiStatus): string {
  switch (status) {
    case 'pending':
      return 'copilot.status.pending';
    case 'error':
      return 'copilot.status.error';
    default:
      return 'copilot.status.idle';
  }
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderBottom: '1px solid rgba(129, 174, 255, 0.15)',
};

const titleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  color: '#ebf1fa',
  flex: 1,
};

function statusStyle(status: AiStatus): React.CSSProperties {
  const color = status === 'error' ? '#ff8a8a' : status === 'pending' ? '#5af8fb' : '#a5acb4';
  return {
    fontSize: 11,
    letterSpacing: 0.04,
    textTransform: 'uppercase',
    color,
  };
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: 18,
  lineHeight: 1,
  color: '#a5acb4',
  cursor: 'pointer',
  padding: '2px 6px',
};
