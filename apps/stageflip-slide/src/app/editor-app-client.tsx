// apps/stageflip-slide/src/app/editor-app-client.tsx
// Client boundary for the walking skeleton. EditorShell brings its own
// providers (shortcuts, document, auth) — this component only supplies
// the initial document and the blank-canvas frame.

'use client';

import { EditorShell, t, useDocument } from '@stageflip/editor-shell';
import type { Document } from '@stageflip/schema';
import type { ReactElement } from 'react';

// Typed via `satisfies` rather than a blind `as Document` cast so TypeScript
// still validates the literal against the schema's inferred shape — if a
// future `Document` change adds a required field, this line goes red instead
// of silently bypassing the check at runtime.
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
    slides: [{ id: 'slide-0', elements: [] }],
  },
} satisfies Document;

export function EditorAppClient(): ReactElement {
  return (
    <EditorShell initialDocument={INITIAL_DOCUMENT}>
      <WalkingSkeletonFrame />
    </EditorShell>
  );
}

function WalkingSkeletonFrame(): ReactElement {
  const { document: doc, activeSlideId } = useDocument();
  const slideCount = doc && doc.content.mode === 'slide' ? doc.content.slides.length : 0;
  const activeSlide =
    activeSlideId || (doc?.content.mode === 'slide' ? doc.content.slides[0]?.id : '');

  return (
    <main data-testid="editor-app" style={mainStyle}>
      <header data-testid="editor-header" style={headerStyle}>
        <span style={{ fontWeight: 600 }}>{doc?.meta.title ?? t('onboarding.welcome')}</span>
        <span style={{ opacity: 0.6 }}>
          {slideCount} {t('status.slides')}
        </span>
      </header>
      <section
        data-testid="blank-canvas"
        data-active-slide-id={activeSlide}
        style={canvasStyle}
        aria-label="Blank canvas"
      >
        <svg
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid meet"
          style={svgStyle}
          role="img"
          aria-labelledby="blank-canvas-title"
        >
          <title id="blank-canvas-title">Blank slide canvas — 1920×1080</title>
          <rect x="0" y="0" width="1920" height="1080" fill="var(--editor-canvas)" />
        </svg>
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

const canvasStyle: React.CSSProperties = {
  flex: 1,
  borderRadius: 12,
  overflow: 'hidden',
  background: 'var(--editor-canvas)',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
};

const svgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'block',
};
