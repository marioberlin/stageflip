// apps/stageflip-slide/src/components/canvas/text-selection-toolbar.tsx
// Floating toolbar that toggles whole-element text formatting (T-123c).

'use client';

import { useDocument } from '@stageflip/editor-shell';
import type {
  Document,
  Element,
  Slide,
  SlideContent,
  TextElement,
  TextRun,
} from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback } from 'react';

/**
 * Toolbar buttons toggle formatting for the WHOLE text element. Per-
 * range (selection-aware) runs are out of scope for T-123c — when
 * that iteration lands, the toolbar will receive the current selection
 * range and splice runs accordingly. Today: one run for the element.
 *
 * Link is a stub — clicking it prompts for a URL but does not yet
 * write any schema. A later iteration will add an inline link element
 * or a run-level link attribute.
 */

export interface TextSelectionToolbarProps {
  element: TextElement;
}

export function TextSelectionToolbar({ element }: TextSelectionToolbarProps): ReactElement {
  const { updateDocument } = useDocument();
  const current = deriveFormatting(element);

  const toggle = useCallback(
    (patch: Partial<{ weight: number; italic: boolean; underline: boolean }>) => {
      updateDocument((doc) => updateRuns(doc, element.id, patch, current));
    },
    [current, element.id, updateDocument],
  );

  return (
    <div
      data-testid={`text-toolbar-${element.id}`}
      role="toolbar"
      aria-label="Text formatting"
      style={toolbarStyle}
      onPointerDown={(e) => e.preventDefault()}
    >
      <ToolbarButton
        active={current.bold}
        label="Bold"
        testId={`text-toolbar-bold-${element.id}`}
        onToggle={() => toggle({ weight: current.bold ? 400 : 700 })}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        active={current.italic}
        label="Italic"
        testId={`text-toolbar-italic-${element.id}`}
        onToggle={() => toggle({ italic: !current.italic })}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        active={current.underline}
        label="Underline"
        testId={`text-toolbar-underline-${element.id}`}
        onToggle={() => toggle({ underline: !current.underline })}
      >
        U
      </ToolbarButton>
      <ToolbarButton
        active={false}
        label="Link"
        testId={`text-toolbar-link-${element.id}`}
        onToggle={() => {
          // Link editor arrives with a later task — stub preserves the
          // UI slot without silently writing bad data.
        }}
      >
        🔗
      </ToolbarButton>
    </div>
  );
}

interface ToolbarButtonProps {
  active: boolean;
  label: string;
  testId: string;
  onToggle: () => void;
  children: ReactElement | string;
}

function ToolbarButton({
  active,
  label,
  testId,
  onToggle,
  children,
}: ToolbarButtonProps): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      aria-pressed={active}
      onClick={onToggle}
      style={{ ...buttonStyle, ...(active ? activeButtonStyle : null) }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

interface Formatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  weight: number;
}

function deriveFormatting(element: TextElement): Formatting {
  const run = element.runs?.[0];
  const weight = run?.weight ?? 400;
  return {
    bold: weight >= 700,
    italic: run?.italic === true,
    underline: run?.underline === true,
    weight,
  };
}

function updateRuns(
  doc: Document,
  elementId: string,
  patch: Partial<{ weight: number; italic: boolean; underline: boolean }>,
  current: Formatting,
): Document {
  if (doc.content.mode !== 'slide') return doc;
  const slides: Slide[] = doc.content.slides.map((slide) => ({
    ...slide,
    elements: mapTextElementRuns(slide.elements, elementId, patch, current),
  }));
  const content: SlideContent = { ...doc.content, slides };
  return { ...doc, content };
}

function mapTextElementRuns(
  elements: Element[],
  elementId: string,
  patch: Partial<{ weight: number; italic: boolean; underline: boolean }>,
  current: Formatting,
): Element[] {
  return elements.map((el) => {
    if (el.id === elementId && el.type === 'text') {
      const weight = patch.weight ?? current.weight;
      const italic = patch.italic ?? current.italic;
      const underline = patch.underline ?? current.underline;
      // Strip keys that are at their defaults so docs don't bloat.
      const run: TextRun = { text: el.text };
      if (weight !== 400) run.weight = weight;
      if (italic) run.italic = true;
      if (underline) run.underline = true;
      const hasAnyFormat = run.weight !== undefined || run.italic || run.underline;
      return hasAnyFormat
        ? ({ ...el, runs: [run] } as Element)
        : ({ ...el, runs: undefined } as Element);
    }
    if (el.type === 'group') {
      return {
        ...el,
        children: mapTextElementRuns(el.children, elementId, patch, current),
      };
    }
    return el;
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const toolbarStyle: CSSProperties = {
  position: 'absolute',
  top: -44,
  left: 0,
  display: 'flex',
  gap: 4,
  padding: 4,
  background: '#151c23',
  border: '1px solid rgba(129, 174, 255, 0.2)',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0, 114, 229, 0.12)',
  pointerEvents: 'auto',
};

const buttonStyle: CSSProperties = {
  width: 28,
  height: 28,
  padding: 0,
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 4,
  color: '#ebf1fa',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const activeButtonStyle: CSSProperties = {
  background: 'rgba(129, 174, 255, 0.2)',
  borderColor: 'rgba(129, 174, 255, 0.6)',
};
