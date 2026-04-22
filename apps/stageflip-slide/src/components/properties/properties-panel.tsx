// apps/stageflip-slide/src/components/properties/properties-panel.tsx
// Right-rail properties panel router (T-125a).

/**
 * Three render branches:
 *
 *   1. An element is selected → `<SelectedElementProperties>` with the
 *      containing slide id + the resolved element.
 *   2. No element selected AND the active slide exists →
 *      `<SlideProperties>` with the slide.
 *   3. No active slide (unhydrated doc or document in a non-slide mode) →
 *      fallback message.
 *
 * The router reads from `elementByIdAtom(selectedElementId)` + the active
 * slide so re-renders stay tightly scoped. When multiple elements are
 * selected (`selectedElementId` returns null because the atom only resolves
 * to a single id on exactly-one selection), we fall through to the slide
 * branch — a future task (T-125c alongside bulk-transform) can add a
 * dedicated multi-select view.
 */

'use client';

import {
  activeSlideIdAtom,
  elementByIdAtom,
  selectedElementIdAtom,
  slideByIdAtom,
  t,
  useEditorShellAtomValue,
} from '@stageflip/editor-shell';
import { type ReactElement, useMemo } from 'react';
import { SelectedElementProperties } from './selected-element-properties';
import { SlideProperties } from './slide-properties';

export function PropertiesPanel(): ReactElement {
  const activeSlideId = useEditorShellAtomValue(activeSlideIdAtom);
  const selectedElementId = useEditorShellAtomValue(selectedElementIdAtom);
  const slideAtom = useMemo(() => slideByIdAtom(activeSlideId), [activeSlideId]);
  const slide = useEditorShellAtomValue(slideAtom);
  const elementAtom = useMemo(() => elementByIdAtom(selectedElementId ?? ''), [selectedElementId]);
  const element = useEditorShellAtomValue(elementAtom);

  const headerName = element?.name ?? element?.type ?? slide?.title ?? t('properties.panel.empty');

  return (
    <aside
      data-testid="properties-panel"
      aria-label={t('properties.panel.ariaLabel')}
      style={asideStyle}
    >
      <header style={headerStyle}>
        <span style={headerLabelStyle}>{t('properties.panel.header')}</span>
        <span data-testid="properties-panel-subject" style={headerSubjectStyle}>
          {headerName}
        </span>
      </header>
      {renderBody()}
    </aside>
  );

  function renderBody(): ReactElement {
    if (element && activeSlideId) {
      return <SelectedElementProperties slideId={activeSlideId} element={element} />;
    }
    if (slide) {
      return <SlideProperties slide={slide} />;
    }
    return (
      <div data-testid="properties-panel-fallback" style={fallbackStyle}>
        <p style={fallbackTextStyle}>{t('properties.fallback')}</p>
      </div>
    );
  }
}

const asideStyle: React.CSSProperties = {
  width: 280,
  display: 'flex',
  flexDirection: 'column',
  background: 'rgba(8, 15, 21, 0.9)',
  border: '1px solid rgba(129, 174, 255, 0.1)',
  borderRadius: 12,
  color: '#ebf1fa',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 12px',
  borderBottom: '1px solid rgba(129, 174, 255, 0.1)',
};

const headerLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.16,
  textTransform: 'uppercase',
  color: '#5af8fb',
};

const headerSubjectStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const fallbackStyle: React.CSSProperties = {
  padding: 20,
  textAlign: 'center',
};

const fallbackTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#5a6068',
  fontSize: 12,
};
