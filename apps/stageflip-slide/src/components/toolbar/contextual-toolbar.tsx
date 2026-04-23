// apps/stageflip-slide/src/components/toolbar/contextual-toolbar.tsx
// Floating selection-driven toolbar (T-139a).

/**
 * Mirrors the PropertiesPanel router from T-125a: a single element-type
 * dispatcher that selects the appropriate variant for the current
 * selection. Renders nothing when no element is selected.
 *
 * Element-type routing
 * --------------------
 *   text  → bold / italic / underline + align + font-size readout.
 *   shape → fill + stroke (both read-only badges today; T-125c's ChartEditor
 *           pattern will arrive here as editable in a follow-up).
 *   image → crop + filter (stubs — parity surface only).
 *   other → element-type badge only.
 *
 * Positioning follows the active selection. The component accepts an
 * `anchor` prop from its mounting site (SlideCanvas). When `anchor` is
 * null the toolbar self-positions via `position: relative` inside its
 * parent. Tests prefer the explicit anchor form.
 *
 * The text variant delegates the bold/italic/underline plumbing to the
 * existing `<TextSelectionToolbar>` (T-123c) by composition: the
 * reference renders a floating toolbar for text during inline-edit, but
 * our contextual toolbar also needs to surface the same controls when a
 * text element is merely selected (not being inline-edited). The
 * simplest path is to re-use the existing helpers at the mutation
 * layer — but to keep the surfaces decoupled the contextual toolbar
 * owns its own text-variant today; if the two diverge, factoring
 * `deriveTextFormatting` + `updateRuns` into a shared module is the
 * next step.
 */

'use client';

import {
  elementByIdAtom,
  selectedElementIdAtom,
  t,
  useDocument,
  useEditorShellAtomValue,
} from '@stageflip/editor-shell';
import type { Document, Element, ShapeElement, TextElement } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

export interface ContextualToolbarProps {
  /**
   * Viewport-space anchor for the toolbar. When provided the toolbar
   * positions absolutely at the anchor; when omitted it lays out inline.
   */
  anchor?: { x: number; y: number } | undefined;
}

export function ContextualToolbar({ anchor }: ContextualToolbarProps = {}): ReactElement | null {
  const selectedId = useEditorShellAtomValue(selectedElementIdAtom);
  const elementAtom = useMemo(() => elementByIdAtom(selectedId ?? ''), [selectedId]);
  const element = useEditorShellAtomValue(elementAtom);

  if (!element) return null;

  return (
    <div
      data-testid="contextual-toolbar"
      data-element-type={element.type}
      role="toolbar"
      aria-label={t('toolbar.contextual.ariaLabel')}
      style={rootStyle(anchor)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ElementTypeBadge element={element} />
      <Divider />
      <Variant element={element} />
    </div>
  );
}

function Variant({ element }: { element: Element }): ReactElement {
  if (element.type === 'text') return <TextVariant element={element as TextElement} />;
  if (element.type === 'shape') return <ShapeVariant element={element as ShapeElement} />;
  if (element.type === 'image') return <ImageVariant />;
  return <OtherVariant />;
}

function ElementTypeBadge({ element }: { element: Element }): ReactElement {
  const labelKey = `toolbar.contextual.type.${element.type}`;
  return (
    <span data-testid="contextual-toolbar-type" style={badgeStyle}>
      {t(labelKey, element.type)}
    </span>
  );
}

function TextVariant({ element }: { element: TextElement }): ReactElement {
  const { updateDocument } = useDocument();
  const formatting = deriveTextFormatting(element);

  const toggleBold = useCallback(() => {
    updateDocument((doc) =>
      patchTextRun(doc, element.id, {
        weight: formatting.bold ? 400 : 700,
      }),
    );
  }, [updateDocument, element.id, formatting.bold]);

  const toggleItalic = useCallback(() => {
    updateDocument((doc) => patchTextRun(doc, element.id, { italic: !formatting.italic }));
  }, [updateDocument, element.id, formatting.italic]);

  const toggleUnderline = useCallback(() => {
    updateDocument((doc) => patchTextRun(doc, element.id, { underline: !formatting.underline }));
  }, [updateDocument, element.id, formatting.underline]);

  const setAlign = useCallback(
    (align: TextElement['align']) => {
      updateDocument((doc) => patchTextAlign(doc, element.id, align));
    },
    [updateDocument, element.id],
  );

  return (
    <>
      <ToolbarToggle
        testId="contextual-toolbar-bold"
        label={t('toolbar.contextual.text.bold')}
        active={formatting.bold}
        onClick={toggleBold}
      >
        B
      </ToolbarToggle>
      <ToolbarToggle
        testId="contextual-toolbar-italic"
        label={t('toolbar.contextual.text.italic')}
        active={formatting.italic}
        onClick={toggleItalic}
      >
        I
      </ToolbarToggle>
      <ToolbarToggle
        testId="contextual-toolbar-underline"
        label={t('toolbar.contextual.text.underline')}
        active={formatting.underline}
        onClick={toggleUnderline}
      >
        U
      </ToolbarToggle>
      <Divider />
      <ToolbarToggle
        testId="contextual-toolbar-align-left"
        label={t('toolbar.contextual.text.alignLeft')}
        active={element.align === 'left'}
        onClick={() => setAlign('left')}
      >
        ⬅
      </ToolbarToggle>
      <ToolbarToggle
        testId="contextual-toolbar-align-center"
        label={t('toolbar.contextual.text.alignCenter')}
        active={element.align === 'center'}
        onClick={() => setAlign('center')}
      >
        ⬍
      </ToolbarToggle>
      <ToolbarToggle
        testId="contextual-toolbar-align-right"
        label={t('toolbar.contextual.text.alignRight')}
        active={element.align === 'right'}
        onClick={() => setAlign('right')}
      >
        ➡
      </ToolbarToggle>
      <Divider />
      <span data-testid="contextual-toolbar-font-size" style={readoutStyle}>
        {element.fontSize ?? '—'}
      </span>
    </>
  );
}

function ShapeVariant({ element }: { element: ShapeElement }): ReactElement {
  const fillLabel = element.fill ?? t('toolbar.contextual.shape.fill');
  const strokeLabel = element.stroke?.color ?? t('toolbar.contextual.shape.stroke');
  return (
    <>
      <span data-testid="contextual-toolbar-fill" style={readoutStyle}>
        {fillLabel}
      </span>
      <Divider />
      <span data-testid="contextual-toolbar-stroke" style={readoutStyle}>
        {strokeLabel}
      </span>
    </>
  );
}

function ImageVariant(): ReactElement {
  return (
    <>
      <span data-testid="contextual-toolbar-crop" style={readoutStyle}>
        {t('toolbar.contextual.image.crop')}
      </span>
      <Divider />
      <span data-testid="contextual-toolbar-filter" style={readoutStyle}>
        {t('toolbar.contextual.image.filter')}
      </span>
    </>
  );
}

function OtherVariant(): ReactElement {
  return <span data-testid="contextual-toolbar-other" style={readoutStyle} />;
}

// ---------------------------------------------------------------------------
// Text mutation helpers
// ---------------------------------------------------------------------------

interface TextFormatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function deriveTextFormatting(element: TextElement): TextFormatting {
  const run = element.runs?.[0];
  const weight = run?.weight ?? 400;
  return {
    bold: weight >= 700,
    italic: run?.italic === true,
    underline: run?.underline === true,
  };
}

function patchTextRun(
  doc: Document,
  elementId: string,
  patch: Partial<{ weight: number; italic: boolean; underline: boolean }>,
): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.id !== elementId || el.type !== 'text') return el;
          const prior = el.runs?.[0];
          const weight = patch.weight ?? prior?.weight ?? 400;
          const italic = patch.italic ?? prior?.italic === true;
          const underline = patch.underline ?? prior?.underline === true;
          const run: { text: string; weight?: number; italic?: boolean; underline?: boolean } = {
            text: el.text,
          };
          if (weight !== 400) run.weight = clampWeight(weight);
          if (italic) run.italic = true;
          if (underline) run.underline = true;
          const hasFormat = run.weight !== undefined || run.italic || run.underline;
          return hasFormat
            ? ({ ...el, runs: [run] } as Element)
            : ({ ...el, runs: undefined } as Element);
        }),
      })),
    },
  };
}

function patchTextAlign(doc: Document, elementId: string, align: TextElement['align']): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => {
          if (el.id !== elementId || el.type !== 'text') return el;
          return { ...el, align } as Element;
        }),
      })),
    },
  };
}

function clampWeight(raw: number): number {
  if (!Number.isFinite(raw)) return 400;
  const rounded = Math.round(raw / 100) * 100;
  return Math.max(100, Math.min(900, rounded));
}

export const __test = { deriveTextFormatting, patchTextRun, patchTextAlign };

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

interface ToolbarToggleProps {
  testId: string;
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactElement | string;
}

function ToolbarToggle({
  testId,
  label,
  active,
  onClick,
  children,
}: ToolbarToggleProps): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      style={toggleStyle(active)}
    >
      {children}
    </button>
  );
}

function Divider(): ReactElement {
  return <span aria-hidden="true" style={dividerStyle} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function rootStyle(anchor?: { x: number; y: number }): CSSProperties {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'rgba(21, 28, 35, 0.85)',
    backdropFilter: 'blur(12px)',
    borderRadius: 999,
    border: '1px solid rgba(129, 174, 255, 0.2)',
    boxShadow: '0 4px 20px rgba(0, 114, 229, 0.12)',
    color: '#ebf1fa',
    fontSize: 12,
    pointerEvents: 'auto',
  };
  if (!anchor) return base;
  return {
    ...base,
    position: 'absolute',
    top: anchor.y,
    left: anchor.x,
    transform: 'translate(-50%, -100%)',
  };
}

const badgeStyle: CSSProperties = {
  padding: '2px 6px',
  fontSize: 10,
  letterSpacing: 0.08,
  textTransform: 'uppercase',
  color: '#5af8fb',
  fontWeight: 700,
};

const dividerStyle: CSSProperties = {
  width: 1,
  height: 14,
  background: 'rgba(165, 172, 180, 0.18)',
};

const readoutStyle: CSSProperties = {
  padding: '4px 8px',
  fontSize: 11,
  color: '#a5acb4',
  fontFamily: 'monospace',
};

function toggleStyle(active: boolean): CSSProperties {
  return {
    width: 26,
    height: 26,
    padding: 0,
    background: active ? 'rgba(129, 174, 255, 0.2)' : 'transparent',
    color: '#ebf1fa',
    border: `1px solid ${active ? 'rgba(129, 174, 255, 0.5)' : 'transparent'}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  };
}
