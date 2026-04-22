// apps/stageflip-slide/src/components/properties/chart-element-properties.test.tsx

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import type { ChartElement, Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChartElementProperties } from './chart-element-properties';
import { Hydrate, makeChartElement, makeDoc, resetAtomCaches } from './test-helpers';

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

function elementAt(doc: Document | null, slideId: string): ChartElement | undefined {
  if (doc?.content.mode !== 'slide') return undefined;
  const slide = doc.content.slides.find((s) => s.id === slideId);
  const el = slide?.elements[0];
  return el?.type === 'chart' ? (el as ChartElement) : undefined;
}

describe('<ChartElementProperties>', () => {
  it('renders chart kind picker prefilled from the element', () => {
    const element = makeChartElement({ chartKind: 'pie' });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const kind = screen.getByTestId('chart-kind') as HTMLSelectElement;
    expect(kind.value).toBe('pie');
  });

  it('commits chartKind change through updateDocument', () => {
    const element = makeChartElement({ chartKind: 'bar' });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const kind = screen.getByTestId('chart-kind') as HTMLSelectElement;
    fireEvent.change(kind, { target: { value: 'line' } });
    expect(elementAt(capture.latest, 'slide-0')?.chartKind).toBe('line');
  });

  it('toggles legend + axes flags via checkboxes', () => {
    const element = makeChartElement({ legend: true, axes: true });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('chart-legend'));
    expect(elementAt(capture.latest, 'slide-0')?.legend).toBe(false);
    fireEvent.click(screen.getByTestId('chart-axes'));
    expect(elementAt(capture.latest, 'slide-0')?.axes).toBe(false);
  });

  it('renders series rows for inline data and commits name / values changes on blur', () => {
    const element = makeChartElement({
      data: {
        labels: ['Q1', 'Q2'],
        series: [{ name: 'Sales', values: [100, 200] }],
      },
    });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const nameInput = screen.getByTestId('chart-series-0-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Sales');
    fireEvent.change(nameInput, { target: { value: 'Revenue' } });
    fireEvent.blur(nameInput);
    let data = elementAt(capture.latest, 'slide-0')?.data;
    if (typeof data === 'string') throw new Error('expected inline data');
    expect(data?.series[0]?.name).toBe('Revenue');

    const valuesInput = screen.getByTestId('chart-series-0-values') as HTMLInputElement;
    expect(valuesInput.value).toBe('100, 200');
    fireEvent.change(valuesInput, { target: { value: '150, 300, 450' } });
    fireEvent.blur(valuesInput);
    data = elementAt(capture.latest, 'slide-0')?.data;
    if (typeof data === 'string') throw new Error('expected inline data');
    expect(data?.series[0]?.values).toEqual([150, 300, 450]);
  });

  it('add-series button appends a new empty series', () => {
    const element = makeChartElement({
      data: { labels: ['Q1'], series: [{ name: 'A', values: [1] }] },
    });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('chart-series-add'));
    const data = elementAt(capture.latest, 'slide-0')?.data;
    if (typeof data === 'string') throw new Error('expected inline data');
    expect(data?.series.length).toBe(2);
    expect(data?.series[1]?.name).toBe('Series 2');
  });

  it('remove-series button drops the indicated series', () => {
    const element = makeChartElement({
      data: {
        labels: ['Q1'],
        series: [
          { name: 'A', values: [1] },
          { name: 'B', values: [2] },
        ],
      },
    });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    fireEvent.click(screen.getByTestId('chart-series-remove-0'));
    const data = elementAt(capture.latest, 'slide-0')?.data;
    if (typeof data === 'string') throw new Error('expected inline data');
    expect(data?.series.length).toBe(1);
    expect(data?.series[0]?.name).toBe('B');
  });

  it('DataSourceRef data renders the bound-data notice instead of the series editor', () => {
    const element = makeChartElement({ data: 'ds:sheet-42' });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('chart-bound-ref')).toBeTruthy();
    expect(screen.queryByTestId('chart-series-add')).toBeNull();
  });

  it('Escape reverts the draft without emitting a commit (guards stale-closure race)', () => {
    const element = makeChartElement({
      data: {
        labels: ['Q1', 'Q2'],
        series: [{ name: 'Sales', values: [100, 200] }],
      },
    });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const nameInput = screen.getByTestId('chart-series-0-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Draft (discard me)' } });
    fireEvent.keyDown(nameInput, { key: 'Escape' });
    // The document atom is still the original; no spurious commit landed.
    const data = elementAt(capture.latest, 'slide-0')?.data;
    if (typeof data === 'string') throw new Error('expected inline data');
    expect(data?.series[0]?.name).toBe('Sales');
  });

  it('disables every mutating control when the element is locked', () => {
    const element = makeChartElement({ locked: true });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <ChartElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect((screen.getByTestId('chart-kind') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId('chart-legend') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('chart-axes') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('chart-series-add') as HTMLButtonElement).disabled).toBe(true);
  });
});
