// apps/stageflip-slide/src/components/properties/slide-properties.tsx
// Slide-level properties (no element selected).

/**
 * T-125a ships read-only summaries plus an editable notes textarea. Editing
 * background / duration / transition is deferred to T-125c where the
 * ChartEditor / TableEditor / AnimationPicker ship — those controls want
 * the same shared form primitives the clip editors will build on.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { Document, Slide } from '@stageflip/schema';
import { type ReactElement, useCallback, useEffect, useState } from 'react';

export interface SlidePropertiesProps {
  slide: Slide;
}

export function SlideProperties({ slide }: SlidePropertiesProps): ReactElement {
  const { updateDocument } = useDocument();

  // Buffer notes locally so typing doesn't touch the document atom on
  // every keystroke — one T-133 undo entry per edit session instead of
  // one per character. Sync back when the slide reference changes
  // (switching slides) or when an external mutation updates the field
  // (e.g. paste from another collaborator in a future phase).
  const [notesDraft, setNotesDraft] = useState<string>(slide.notes ?? '');
  // `slide.id` is included to reset the draft when the user switches
  // slides — without it, an un-committed draft from slide A would leak
  // into slide B's textarea whenever B happens to have the same notes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset-on-slide-switch
  useEffect(() => {
    setNotesDraft(slide.notes ?? '');
  }, [slide.id, slide.notes]);

  const commitNotes = useCallback(() => {
    if (notesDraft === (slide.notes ?? '')) return;
    updateDocument((doc) => applySlideNotes(doc, slide.id, notesDraft));
  }, [notesDraft, slide.id, slide.notes, updateDocument]);

  return (
    <div data-testid="slide-properties" style={rootStyle}>
      <Row label={t('properties.slide.id')} value={slide.id} mono />
      <Row
        label={t('properties.slide.title')}
        value={slide.title ?? t('properties.slide.untitled')}
        muted={!slide.title}
      />
      <Row
        label={t('properties.slide.background')}
        value={formatBackground(slide)}
        testId="slide-prop-background"
        muted={!slide.background}
      />
      <Row
        label={t('properties.slide.duration')}
        value={slide.durationMs ? `${slide.durationMs} ms` : t('properties.slide.auto')}
        muted={!slide.durationMs}
        testId="slide-prop-duration"
      />
      <Row
        label={t('properties.slide.elements')}
        value={`${slide.elements.length}`}
        testId="slide-prop-element-count"
      />
      <label style={notesWrapStyle}>
        <span style={notesLabelStyle}>{t('properties.slide.notes')}</span>
        <textarea
          data-testid="slide-prop-notes"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          rows={4}
          placeholder={t('properties.slide.notesPlaceholder')}
          style={notesInputStyle}
        />
      </label>
    </div>
  );
}

function formatBackground(slide: Slide): string {
  if (!slide.background) return t('properties.slide.backgroundNone');
  if (slide.background.kind === 'color') return slide.background.value;
  return slide.background.value; // 'asset:<id>'
}

function applySlideNotes(doc: Document, slideId: string, notes: string): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((s) => {
        if (s.id !== slideId) return s;
        if (notes.length === 0) {
          // Typing-back to empty is "no notes" — strip the field rather than
          // persist an empty string so downstream consumers (export, diff)
          // see a clean absence of speaker notes.
          const { notes: _removed, ...rest } = s;
          return rest;
        }
        return { ...s, notes };
      }),
    },
  };
}

function Row({
  label,
  value,
  mono,
  muted,
  testId,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  testId?: string;
}): ReactElement {
  return (
    <div style={rowStyle} data-testid={testId}>
      <span style={rowLabelStyle}>{label}</span>
      <span
        style={{
          ...rowValueStyle,
          ...(mono ? { fontFamily: 'monospace' } : {}),
          ...(muted ? { color: '#5a6068' } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

export const __test = {
  applySlideNotes,
  formatBackground,
};

// ---- styles ---------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '16px 14px',
  overflowY: 'auto',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  background: 'rgba(21, 28, 35, 0.6)',
  borderRadius: 6,
  fontSize: 11,
};

const rowLabelStyle: React.CSSProperties = {
  color: '#a5acb4',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.04,
  textTransform: 'uppercase',
};

const rowValueStyle: React.CSSProperties = {
  color: '#ebf1fa',
  maxWidth: '60%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const notesWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 4,
};

const notesLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#a5acb4',
  fontWeight: 700,
  letterSpacing: 0.14,
  textTransform: 'uppercase',
};

const notesInputStyle: React.CSSProperties = {
  resize: 'vertical',
  background: '#151c23',
  color: '#ebf1fa',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'inherit',
};
