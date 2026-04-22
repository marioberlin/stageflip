// apps/stageflip-slide/src/components/properties/table-element-properties.test.tsx

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import type { Document, TableElement } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TableElementProperties, __test } from './table-element-properties';
import { Hydrate, makeDoc, makeTableElement, resetAtomCaches } from './test-helpers';

afterEach(() => {
  cleanup();
  resetAtomCaches();
});

function Snapshot({ onDoc }: { onDoc: (doc: Document | null) => void }): null {
  const { document } = useDocument();
  useEffect(() => {
    onDoc(document);
  }, [document, onDoc]);
  return null;
}

function elementAt(doc: Document | null): TableElement | undefined {
  if (doc?.content.mode !== 'slide') return undefined;
  const el = doc.content.slides[0]?.elements[0];
  return el?.type === 'table' ? (el as TableElement) : undefined;
}

describe('<TableElementProperties> — render + structural edits', () => {
  it('renders rows / columns readouts and headerRow toggle', () => {
    const element = makeTableElement();
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('table-rows').textContent).toBe('2');
    expect(screen.getByTestId('table-columns').textContent).toBe('2');
    expect((screen.getByTestId('table-header-row') as HTMLInputElement).checked).toBe(true);
  });

  it('add-row adds one row with filler cells', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('table-add-row'));
    const el = elementAt(capture.latest);
    expect(el?.rows).toBe(3);
    // One filler cell per column on the new row.
    expect(el?.cells.filter((c) => c.row === 2).length).toBe(2);
  });

  it('add-column adds one column with filler cells', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('table-add-column'));
    const el = elementAt(capture.latest);
    expect(el?.columns).toBe(3);
    expect(el?.cells.filter((c) => c.col === 2).length).toBe(2);
  });

  it('remove-row drops the trailing row and its cells', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('table-remove-row'));
    const el = elementAt(capture.latest);
    expect(el?.rows).toBe(1);
    expect(el?.cells.every((c) => c.row < 1)).toBe(true);
  });

  it('remove-column drops the trailing column and its cells', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('table-remove-column'));
    const el = elementAt(capture.latest);
    expect(el?.columns).toBe(1);
    expect(el?.cells.every((c) => c.col < 1)).toBe(true);
  });

  it('remove-row is disabled at 1 row; remove-column is disabled at 1 column', () => {
    const element = makeTableElement({
      rows: 1,
      columns: 1,
      cells: [{ row: 0, col: 0, content: 'x', align: 'left', colspan: 1, rowspan: 1 }],
    });
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect((screen.getByTestId('table-remove-row') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('table-remove-column') as HTMLButtonElement).disabled).toBe(true);
  });

  it('headerRow toggle flips the flag', () => {
    const element = makeTableElement({ headerRow: true });
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('table-header-row'));
    expect(elementAt(capture.latest)?.headerRow).toBe(false);
  });
});

describe('<TableElementProperties> — cell edits', () => {
  it('editing a cell commits its content on blur', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const cell = screen.getByTestId('table-cell-0-0-content') as HTMLInputElement;
    fireEvent.change(cell, { target: { value: 'Quarter' } });
    fireEvent.blur(cell);
    const el = elementAt(capture.latest);
    const changed = el?.cells.find((c) => c.row === 0 && c.col === 0);
    expect(changed?.content).toBe('Quarter');
  });

  it('changing align on a cell commits immediately', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const alignSelect = screen.getByTestId('table-cell-1-1-align') as HTMLSelectElement;
    fireEvent.change(alignSelect, { target: { value: 'right' } });
    const el = elementAt(capture.latest);
    const changed = el?.cells.find((c) => c.row === 1 && c.col === 1);
    expect(changed?.align).toBe('right');
  });
});

describe('<TableElementProperties> — Escape revert', () => {
  it('Escape on a cell input reverts the draft without committing (stale-closure guard)', () => {
    const element = makeTableElement();
    const capture: { latest: Document | null } = { latest: null };
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot
          onDoc={(d) => {
            capture.latest = d;
          }}
        />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const cell = screen.getByTestId('table-cell-0-0-content') as HTMLInputElement;
    fireEvent.change(cell, { target: { value: 'Draft (discard me)' } });
    fireEvent.keyDown(cell, { key: 'Escape' });
    const el = elementAt(capture.latest);
    const unchanged = el?.cells.find((c) => c.row === 0 && c.col === 0);
    expect(unchanged?.content).toBe('H1');
  });
});

describe('table — pure helpers', () => {
  it('addRow appends filler cells at the new row with "left" align', () => {
    const before = makeTableElement();
    const after = __test.addRow(before);
    expect(after.rows).toBe(3);
    expect(after.cells.filter((c) => c.row === 2)).toEqual([
      { row: 2, col: 0, content: '', align: 'left', colspan: 1, rowspan: 1 },
      { row: 2, col: 1, content: '', align: 'left', colspan: 1, rowspan: 1 },
    ]);
  });

  it('addColumn appends filler cells at the new column', () => {
    const before = makeTableElement();
    const after = __test.addColumn(before);
    expect(after.columns).toBe(3);
    expect(after.cells.filter((c) => c.col === 2)).toEqual([
      { row: 0, col: 2, content: '', align: 'left', colspan: 1, rowspan: 1 },
      { row: 1, col: 2, content: '', align: 'left', colspan: 1, rowspan: 1 },
    ]);
  });
});

describe('<TableElementProperties> — lock', () => {
  it('disables every mutating control when locked', () => {
    const element = makeTableElement({ locked: true });
    render(
      <DocumentProvider initialDocument={makeDoc({ elements: [element] })}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <TableElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect((screen.getByTestId('table-header-row') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('table-add-row') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('table-add-column') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('table-cell-0-0-content') as HTMLInputElement).disabled).toBe(true);
  });
});
