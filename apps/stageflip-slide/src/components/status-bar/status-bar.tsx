// apps/stageflip-slide/src/components/status-bar/status-bar.tsx
// Bottom status bar (T-129): slide count + total element count + import-
// diagnostics badge (T-248).

/**
 * Thin read-only strip that reports document-wide counts. Reads live
 * state via `useDocument()`; no mutations. Non-slide-mode documents and
 * unhydrated state resolve to zero so the bar never crashes on first paint.
 *
 * Shipped slots: slide count, element count, import-diagnostics badge
 * (T-248 — opens the loss-flag reporter modal). Future additions
 * (deferred): save-state indicator, connection status, font-preload
 * progress. Each gets its own slot to avoid re-layout churn.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { LossFlagBadge } from './loss-flag-badge';

export function StatusBar(): ReactElement {
  const { document } = useDocument();
  const { slideCount, elementCount } = summarize(document);

  return (
    <footer data-testid="status-bar" style={rootStyle} aria-label="Status">
      <span data-testid="status-slide-count" style={cellStyle}>
        {slideCount} {t('status.slides')}
      </span>
      <span data-testid="status-element-count" style={cellStyle}>
        {elementCount} {t('status.elements')}
      </span>
      <LossFlagBadge />
    </footer>
  );
}

function summarize(document: Document | null): { slideCount: number; elementCount: number } {
  if (!document || document.content.mode !== 'slide') {
    return { slideCount: 0, elementCount: 0 };
  }
  const slides = document.content.slides;
  let elementCount = 0;
  for (const slide of slides) elementCount += slide.elements.length;
  return { slideCount: slides.length, elementCount };
}

export const __test = { summarize };

const rootStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  padding: '6px 12px',
  borderTop: '1px solid rgba(165, 172, 180, 0.1)',
  fontSize: 11,
  color: '#a5acb4',
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};

const cellStyle: CSSProperties = {
  letterSpacing: 0.04,
};
