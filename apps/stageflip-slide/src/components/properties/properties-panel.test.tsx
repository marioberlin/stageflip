// apps/stageflip-slide/src/components/properties/properties-panel.test.tsx

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import { cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PropertiesPanel } from './properties-panel';
import { Hydrate, makeDoc, makeTextElement, resetAtomCaches } from './test-helpers';

afterEach(() => {
  cleanup();
  resetAtomCaches();
});

function MultiSelect({ ids }: { ids: string[] }): null {
  const { selectElements } = useDocument();
  useEffect(() => {
    selectElements(new Set(ids));
  }, [selectElements, ids]);
  return null;
}

describe('<PropertiesPanel> — routing', () => {
  it('renders the fallback when the document is unhydrated (no active slide)', () => {
    render(
      <DocumentProvider initialDocument={null}>
        <PropertiesPanel />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('properties-panel')).toBeTruthy();
    expect(screen.getByTestId('properties-panel-fallback')).toBeTruthy();
  });

  it('renders <SlideProperties> when a slide is active and nothing is selected', () => {
    const doc = makeDoc();
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" />
        <PropertiesPanel />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('slide-properties')).toBeTruthy();
    expect(screen.queryByTestId('selected-element-properties')).toBeNull();
  });

  it('renders <SelectedElementProperties> when exactly one element is selected', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <PropertiesPanel />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('selected-element-properties')).toBeTruthy();
    expect(screen.queryByTestId('slide-properties')).toBeNull();
  });

  it('renders the element name as the header subject when selected + named', () => {
    const element = makeTextElement('el-1', { name: 'Title' });
    const doc = makeDoc({ elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <PropertiesPanel />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('properties-panel-subject').textContent).toBe('Title');
  });

  it('falls back to the element type when the element has no name', () => {
    const element = makeTextElement('el-1');
    const doc = makeDoc({ elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId="el-1" />
        <PropertiesPanel />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('properties-panel-subject').textContent).toBe('text');
  });

  it('routes to the slide branch when multiple elements are selected (selectedElementId is null)', () => {
    const el1 = makeTextElement('el-1');
    const el2 = makeTextElement('el-2');
    const doc = makeDoc({ elements: [el1, el2] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" />
        <MultiSelect ids={['el-1', 'el-2']} />
        <PropertiesPanel />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('slide-properties')).toBeTruthy();
    expect(screen.queryByTestId('selected-element-properties')).toBeNull();
  });
});
