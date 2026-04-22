// apps/stageflip-slide/src/components/canvas/text-selection-toolbar.test.tsx
// Toolbar buttons must toggle whole-element runs[] in the document (T-123c).

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import type { Document, Slide, TextElement, TextRun } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TextSelectionToolbar } from './text-selection-toolbar';

afterEach(() => {
  cleanup();
});

function baseText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: 'el-t',
    type: 'text',
    transform: { x: 0, y: 0, width: 400, height: 80, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    text: 'Hello',
    align: 'left',
    ...overrides,
  } as TextElement;
}

function docWith(element: TextElement): Document {
  const slide: Slide = { id: 'slide-0', elements: [element] };
  return {
    meta: {
      id: 'd',
      version: 0,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: { mode: 'slide', slides: [slide] },
  } as Document;
}

function RunsProbe({
  id,
  onRuns,
}: {
  id: string;
  onRuns: (runs: ReadonlyArray<TextRun> | undefined) => void;
}): null {
  const { document: doc } = useDocument();
  useEffect(() => {
    if (!doc || doc.content.mode !== 'slide') return;
    for (const s of doc.content.slides) {
      const el = s.elements.find((e) => e.id === id);
      if (el && el.type === 'text') onRuns(el.runs);
    }
  }, [doc, id, onRuns]);
  return null;
}

function renderWith(element: TextElement) {
  const snapshots: Array<ReadonlyArray<TextRun> | undefined> = [];
  const utils = render(
    <DocumentProvider initialDocument={docWith(element)}>
      <RunsProbe id={element.id} onRuns={(runs) => snapshots.push(runs)} />
      <TextSelectionToolbar element={element} />
    </DocumentProvider>,
  );
  return { ...utils, snapshots };
}

describe('<TextSelectionToolbar> — affordances', () => {
  it('renders 4 buttons with toolbar role + button semantics', () => {
    const el = baseText();
    render(
      <DocumentProvider initialDocument={docWith(el)}>
        <TextSelectionToolbar element={el} />
      </DocumentProvider>,
    );
    expect(screen.getByRole('toolbar')).toBeTruthy();
    expect(screen.getByTestId(`text-toolbar-bold-${el.id}`)).toBeTruthy();
    expect(screen.getByTestId(`text-toolbar-italic-${el.id}`)).toBeTruthy();
    expect(screen.getByTestId(`text-toolbar-underline-${el.id}`)).toBeTruthy();
    expect(screen.getByTestId(`text-toolbar-link-${el.id}`)).toBeTruthy();
  });
});

describe('<TextSelectionToolbar> — bold', () => {
  it('sets runs[0].weight to 700 when toggled on', () => {
    const el = baseText();
    const { snapshots } = renderWith(el);
    fireEvent.click(screen.getByTestId(`text-toolbar-bold-${el.id}`));
    const last = snapshots[snapshots.length - 1];
    expect(last?.[0]?.weight).toBe(700);
  });

  it('drops runs when toggling bold back off', () => {
    const el = baseText({ runs: [{ text: 'Hello', weight: 700 }] });
    const { snapshots } = renderWith(el);
    fireEvent.click(screen.getByTestId(`text-toolbar-bold-${el.id}`));
    const last = snapshots[snapshots.length - 1];
    expect(last).toBeUndefined();
  });
});

describe('<TextSelectionToolbar> — italic + underline', () => {
  it('sets italic true when toggled', () => {
    const el = baseText();
    const { snapshots } = renderWith(el);
    fireEvent.click(screen.getByTestId(`text-toolbar-italic-${el.id}`));
    const last = snapshots[snapshots.length - 1];
    expect(last?.[0]?.italic).toBe(true);
  });

  it('sets underline true when toggled', () => {
    const el = baseText();
    const { snapshots } = renderWith(el);
    fireEvent.click(screen.getByTestId(`text-toolbar-underline-${el.id}`));
    const last = snapshots[snapshots.length - 1];
    expect(last?.[0]?.underline).toBe(true);
  });
});

describe('<TextSelectionToolbar> — weight sanitization', () => {
  it('rounds non-multiple-of-100 weights to the nearest valid value on any write', () => {
    // Imported docs can carry off-grid weight values (e.g. 350). Any
    // subsequent write must clamp before persisting or Zod parse fails.
    const el = baseText({ runs: [{ text: 'Hello', weight: 350, italic: true }] });
    const { snapshots } = renderWith(el);
    fireEvent.click(screen.getByTestId(`text-toolbar-underline-${el.id}`));
    const last = snapshots[snapshots.length - 1];
    // 350 rounds to 400 — the default — and is stripped from the run.
    expect(last?.[0]?.weight).toBeUndefined();
    expect(last?.[0]?.italic).toBe(true);
    expect(last?.[0]?.underline).toBe(true);
  });

  it('clamps out-of-range weights into [100, 900]', () => {
    // 900 is already at the upper bound — sanitization must not push
    // it out. This is the regression guard against "rounded + 100".
    const el = baseText({ runs: [{ text: 'Hello', weight: 900, italic: true }] });
    const { snapshots } = renderWith(el);
    fireEvent.click(screen.getByTestId(`text-toolbar-underline-${el.id}`));
    const last = snapshots[snapshots.length - 1];
    expect(last?.[0]?.weight).toBe(900);
  });
});

describe('<TextSelectionToolbar> — aria state', () => {
  it('aria-pressed reflects bold state on the button', () => {
    const el = baseText({ runs: [{ text: 'Hello', weight: 700 }] });
    render(
      <DocumentProvider initialDocument={docWith(el)}>
        <TextSelectionToolbar element={el} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId(`text-toolbar-bold-${el.id}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByTestId(`text-toolbar-italic-${el.id}`).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
