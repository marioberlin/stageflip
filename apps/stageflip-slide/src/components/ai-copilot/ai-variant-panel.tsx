// apps/stageflip-slide/src/components/ai-copilot/ai-variant-panel.tsx
// Gallery of agent-proposed slide variants. Phase 6 stub: empty-state only.

/**
 * The panel renders nothing when `variants` is empty; an empty-state card
 * appears only when `showEmptyState` is forced on (used by the host
 * container so the copilot still communicates "I have a variants surface"
 * on first open). Phase 7 fills in the cards — each variant becomes a
 * thumbnail plus Apply / Dismiss affordances driven by the validation
 * engine's diff preview.
 */

'use client';

import { t } from '@stageflip/editor-shell';
import type { ReactElement } from 'react';

export interface Variant {
  id: string;
  label: string;
  /** Thumbnail URL — optional; Phase 6 stub ships no variants. */
  thumbnailUrl?: string;
}

export interface AiVariantPanelProps {
  variants: ReadonlyArray<Variant>;
  onSelect: (variantId: string) => void;
  /** Render the empty-state card even when the variant list is empty. */
  showEmptyState?: boolean;
}

export function AiVariantPanel({
  variants,
  onSelect,
  showEmptyState = false,
}: AiVariantPanelProps): ReactElement | null {
  if (variants.length === 0) {
    if (!showEmptyState) return null;
    return (
      <section data-testid="ai-variant-panel-empty" style={emptyCardStyle}>
        <span style={emptyLabelStyle}>{t('copilot.variants.empty')}</span>
      </section>
    );
  }
  return (
    <section data-testid="ai-variant-panel" style={galleryStyle} aria-label={t('copilot.variants')}>
      {variants.map((v) => (
        <button
          key={v.id}
          type="button"
          data-testid={`ai-variant-${v.id}`}
          onClick={() => onSelect(v.id)}
          style={variantCardStyle}
        >
          {v.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumbnailUrl} alt={v.label} style={thumbStyle} />
          ) : (
            <span style={thumbPlaceholderStyle}>{v.label.slice(0, 2).toUpperCase()}</span>
          )}
          <span style={variantLabelStyle}>{v.label}</span>
        </button>
      ))}
    </section>
  );
}

const emptyCardStyle: React.CSSProperties = {
  padding: '16px 12px',
  margin: '8px 12px',
  borderRadius: 8,
  border: '1px dashed rgba(129, 174, 255, 0.25)',
  textAlign: 'center',
};

const emptyLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#a5acb4',
};

const galleryStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 8,
  padding: '8px 12px',
};

const variantCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  padding: 8,
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 6,
  color: '#ebf1fa',
  cursor: 'pointer',
};

const thumbStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  objectFit: 'cover',
  borderRadius: 4,
  background: '#151c23',
};

const thumbPlaceholderStyle: React.CSSProperties = {
  ...thumbStyle,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  color: '#5af8fb',
  letterSpacing: 0.08,
};

const variantLabelStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: '#a5acb4',
  textAlign: 'left',
};
