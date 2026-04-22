// apps/stageflip-slide/src/app/editor-app-client.tsx
// Client boundary for the editor. EditorShell brings its own providers
// (shortcuts, document, auth); this module supplies the initial
// document and composes the T-123-family canvas surface.

'use client';

import {
  EditorShell,
  type Shortcut,
  activeSlideIdAtom,
  slideByIdAtom,
  t,
  useDocument,
  useEditorShellAtomValue,
  useRegisterShortcuts,
} from '@stageflip/editor-shell';
import type { Document, Slide } from '@stageflip/schema';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiCopilot } from '../components/ai-copilot/ai-copilot';
import { SlideCanvas } from '../components/canvas/slide-canvas';
import { SlidePlayer } from '../components/canvas/slide-player';
import { CommandPalette } from '../components/command-palette/command-palette';
import { Filmstrip } from '../components/filmstrip/filmstrip';
import { PropertiesPanel } from '../components/properties/properties-panel';
import { TimelinePanel } from '../components/timeline/timeline-panel';

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
      {
        id: 'slide-1',
        elements: [
          {
            id: 'seed-bullet',
            type: 'text' as const,
            transform: {
              x: 160,
              y: 460,
              width: 1600,
              height: 120,
              rotation: 0,
              opacity: 1,
            },
            visible: true,
            locked: false,
            animations: [],
            text: 'Second slide',
            align: 'center' as const,
            fontSize: 64,
            color: '#ebf1fa' as const,
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

const FPS = 30;
const DURATION_IN_FRAMES = 60;

/**
 * Returns true when focus is NOT inside a contenteditable node. Used to gate
 * `Mod+Z` / `Mod+Shift+Z` — contenteditable owns its own undo history, so
 * routing these combos to the document atom when a contenteditable has focus
 * would pop two undos at once.
 *
 * Safe in SSR + Jest/happy-dom: guards every `document` / `window` read.
 */
function isNotEditingText(): boolean {
  if (typeof document === 'undefined') return true;
  const active = document.activeElement as HTMLElement | null;
  return !(active?.isContentEditable ?? false);
}

function EditorFrame(): ReactElement {
  const { document: doc, undo, redo } = useDocument();
  const slideCount = doc && doc.content.mode === 'slide' ? doc.content.slides.length : 0;
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const activeSlideId = useEditorShellAtomValue(activeSlideIdAtom);
  const slideAtom = useMemo(() => slideByIdAtom(activeSlideId), [activeSlideId]);
  const slide = useEditorShellAtomValue(slideAtom);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const toggleCopilot = useCallback(() => setCopilotOpen((v) => !v), []);
  const closeCopilot = useCallback(() => setCopilotOpen(false), []);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        id: 'help.command-palette',
        combo: 'Mod+K',
        description: 'Open command palette',
        category: 'help',
        handler: () => {
          openPalette();
          return undefined;
        },
      },
      {
        id: 'ai.toggle',
        combo: 'Mod+I',
        description: 'Toggle AI copilot',
        category: 'help',
        handler: () => {
          toggleCopilot();
          return undefined;
        },
      },
      // T-133 wired the undo / redo API; T-136 exposes it to the user as
      // keyboard shortcuts. The `Mod+Shift+Z` variant is the de-facto cross-
      // platform redo combo and is handled by our shortcut matcher ahead of
      // the plain `Mod+Z` binding.
      //
      // Gated by `when: !isEditingText()` so the shortcut does NOT fire when
      // focus is inside a contenteditable node (the inline text editor).
      // Without this guard, pressing Mod+Z while mid-edit would pop the
      // document's MicroUndo stack AND trigger the browser's native
      // contenteditable undo — two undos per keystroke, document out of sync
      // with DOM.
      {
        id: 'edit.redo',
        combo: 'Mod+Shift+Z',
        description: 'Redo',
        category: 'essential',
        when: isNotEditingText,
        handler: () => {
          redo();
          return undefined;
        },
      },
      {
        id: 'edit.undo',
        combo: 'Mod+Z',
        description: 'Undo',
        category: 'essential',
        when: isNotEditingText,
        handler: () => {
          undo();
          return undefined;
        },
      },
    ],
    [openPalette, toggleCopilot, undo, redo],
  );
  useRegisterShortcuts(shortcuts);

  return (
    <main data-testid="editor-app" style={mainStyle}>
      <header data-testid="editor-header" style={headerStyle}>
        <span style={{ fontWeight: 600 }}>{doc?.meta.title ?? t('onboarding.welcome')}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ opacity: 0.6 }}>
            {slideCount} {t('status.slides')}
          </span>
          <button
            type="button"
            data-testid="palette-open"
            onClick={openPalette}
            style={paletteButtonStyle}
          >
            {t('commandPalette.placeholder')}
          </button>
          <button
            type="button"
            data-testid="copilot-toggle"
            aria-pressed={copilotOpen}
            onClick={toggleCopilot}
            style={copilotButtonStyle(copilotOpen)}
          >
            {t('nav.ai')}
          </button>
          <button
            type="button"
            data-testid="mode-toggle"
            data-mode={mode}
            aria-pressed={mode === 'preview'}
            onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
            style={modeButtonStyle(mode === 'preview')}
          >
            {mode === 'edit' ? t('nav.present') : t('nav.edit')}
          </button>
        </div>
      </header>
      <section style={workspaceStyle} aria-label="Canvas workspace">
        <Filmstrip />
        <div style={canvasFrameStyle}>
          {mode === 'edit' ? (
            <SlideCanvas />
          ) : (
            <PreviewFrame
              slide={slide ?? null}
              currentFrame={currentFrame}
              onFrame={setCurrentFrame}
            />
          )}
        </div>
        <PropertiesPanel />
      </section>
      {slide ? (
        <TimelinePanel
          slide={slide}
          fps={FPS}
          durationInFrames={DURATION_IN_FRAMES}
          currentFrame={currentFrame}
          onCurrentFrameChange={setCurrentFrame}
        />
      ) : null}
      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <AiCopilot open={copilotOpen} onClose={closeCopilot} />
    </main>
  );
}

const paletteButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(129, 174, 255, 0.3)',
  borderRadius: 6,
  color: '#a5acb4',
  fontSize: 12,
  cursor: 'pointer',
};

function copilotButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: active ? 'rgba(90, 248, 251, 0.15)' : 'transparent',
    border: `1px solid ${active ? '#5af8fb' : 'rgba(129, 174, 255, 0.3)'}`,
    borderRadius: 6,
    color: active ? '#5af8fb' : '#a5acb4',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

function PreviewFrame({
  slide,
  currentFrame,
  onFrame,
}: {
  slide: Slide | null;
  currentFrame: number;
  onFrame: (frame: number) => void;
}): ReactElement | null {
  if (!slide) return null;
  return (
    <div style={previewCenterStyle}>
      <SlidePlayer
        slide={slide}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={DURATION_IN_FRAMES}
        currentFrame={currentFrame}
        onFrameChange={onFrame}
      />
    </div>
  );
}

function modeButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    background: active ? '#81aeff' : 'transparent',
    color: active ? '#080f15' : '#ebf1fa',
    border: `1px solid ${active ? '#81aeff' : 'rgba(129,174,255,0.4)'}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const previewCenterStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

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

const workspaceStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  gap: 16,
  overflow: 'hidden',
};
