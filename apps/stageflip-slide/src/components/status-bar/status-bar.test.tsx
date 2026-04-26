// apps/stageflip-slide/src/components/status-bar/status-bar.test.tsx

import {
  DocumentProvider,
  EditorShell,
  importLossFlagsAtom,
  useEditorShellSetAtom,
} from '@stageflip/editor-shell';
import type { LossFlag } from '@stageflip/loss-flags';
import type { Document } from '@stageflip/schema';
import { cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusBar } from './status-bar';

afterEach(() => cleanup());

function makeDoc(slideCount: number, elementCount: number): Document {
  const slides = Array.from({ length: slideCount }, (_, i) => ({
    id: `slide-${i}`,
    elements: Array.from({ length: elementCount }, (__, j) => ({
      id: `el-${i}-${j}`,
      transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'text' as const,
      text: 't',
      align: 'left' as const,
    })),
  }));
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
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides },
  };
}

describe('<StatusBar>', () => {
  it('renders slide + element counts summed across the whole document', () => {
    render(
      <DocumentProvider initialDocument={makeDoc(3, 2)}>
        <StatusBar />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('status-bar')).toBeTruthy();
    expect(screen.getByTestId('status-slide-count').textContent).toContain('3');
    expect(screen.getByTestId('status-element-count').textContent).toContain('6');
  });

  it('renders zero-state when the document is unhydrated', () => {
    render(
      <DocumentProvider initialDocument={null}>
        <StatusBar />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('status-slide-count').textContent).toContain('0');
    expect(screen.getByTestId('status-element-count').textContent).toContain('0');
  });

  it('renders zero-element count when a document has slides but no elements', () => {
    render(
      <DocumentProvider initialDocument={makeDoc(2, 0)}>
        <StatusBar />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('status-slide-count').textContent).toContain('2');
    expect(screen.getByTestId('status-element-count').textContent).toContain('0');
  });

  it('renders the loss-flag badge in its status-bar slot when flags exist (T-248)', () => {
    function Seed({ flags }: { flags: readonly LossFlag[] }): null {
      const set = useEditorShellSetAtom(importLossFlagsAtom);
      useEffect(() => {
        set(flags);
      }, [set, flags]);
      return null;
    }
    const flag: LossFlag = {
      id: 'f1',
      source: 'pptx',
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      severity: 'warn',
      category: 'shape',
      location: {},
      message: 'm',
    };
    render(
      <EditorShell initialDocument={makeDoc(1, 0)}>
        <Seed flags={[flag]} />
        <StatusBar />
      </EditorShell>,
    );
    expect(screen.getByTestId('loss-flag-badge')).toBeTruthy();
  });
});
