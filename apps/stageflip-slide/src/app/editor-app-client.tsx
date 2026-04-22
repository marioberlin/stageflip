// apps/stageflip-slide/src/app/editor-app-client.tsx
// Client boundary for the editor. EditorShell brings its own providers
// (shortcuts, document, auth); this module supplies the initial
// document and composes the T-123-family canvas surface.

'use client';

import { EditorShell, t, useDocument } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { SlideCanvas } from '../components/canvas/slide-canvas';

// Typed via `satisfies` rather than a blind `as Document` cast so TypeScript
// still validates the literal against the schema's inferred shape.
const INITIAL_DOCUMENT = {
  meta: {
    id: 'walking-skeleton',
    version: 0,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
    title: 'Walking skeleton',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  content: {
    mode: 'slide',
    slides: [
      {
        id: 'slide-0',
        elements: [
          {
            id: 'seed-title',
            type: 'text' as const,
            transform: {
              x: 160,
              y: 360,
              width: 1600,
              height: 120,
              rotation: 0,
              opacity: 1,
            },
            visible: true,
            locked: false,
            animations: [],
            text: 'StageFlip.Slide',
            align: 'center' as const,
            fontSize: 96,
            color: '#ebf1fa' as const,
          },
          {
            id: 'seed-subtitle',
            type: 'text' as const,
            transform: {
              x: 160,
              y: 520,
              width: 1600,
              height: 60,
              rotation: 0,
              opacity: 1,
            },
            visible: true,
            locked: false,
            animations: [],
            text: 'Walking skeleton',
            align: 'center' as const,
            fontSize: 32,
            color: '#a5acb4' as const,
          },
        ],
      },
    ],
  },
} satisfies Document;

export function EditorAppClient(): ReactElement {
  return (
    <EditorShell initialDocument={INITIAL_DOCUMENT}>
      <ActiveSlideHydrator />
      <EditorFrame />
    </EditorShell>
  );
}

/**
 * Seeds the active slide on mount. Without this the canvas falls to the
 * empty state on first paint. The document-provider contract leaves the
 * active slide id empty so apps can decide the hydration policy.
 */
function ActiveSlideHydrator(): null {
  const { document: doc, activeSlideId, setActiveSlide } = useDocument();
  useEffect(() => {
    if (activeSlideId) return;
    if (!doc || doc.content.mode !== 'slide') return;
    const first = doc.content.slides[0]?.id;
    if (first) setActiveSlide(first);
  }, [doc, activeSlideId, setActiveSlide]);
  return null;
}

function EditorFrame(): ReactElement {
  const { document: doc } = useDocument();
  const slideCount = doc && doc.content.mode === 'slide' ? doc.content.slides.length : 0;

  return (
    <main data-testid="editor-app" style={mainStyle}>
      <header data-testid="editor-header" style={headerStyle}>
        <span style={{ fontWeight: 600 }}>{doc?.meta.title ?? t('onboarding.welcome')}</span>
        <span style={{ opacity: 0.6 }}>
          {slideCount} {t('status.slides')}
        </span>
      </header>
      <section style={canvasFrameStyle} aria-label="Canvas workspace">
        <SlideCanvas />
      </section>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  padding: 24,
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  letterSpacing: 0.02,
};

const canvasFrameStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  borderRadius: 12,
  overflow: 'hidden',
};
