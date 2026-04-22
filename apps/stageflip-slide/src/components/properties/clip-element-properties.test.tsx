// apps/stageflip-slide/src/components/properties/clip-element-properties.test.tsx

import { DocumentProvider, useDocument } from '@stageflip/editor-shell';
import { __clearRuntimeRegistry, registerRuntime } from '@stageflip/runtimes-contract';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import type { ClipElement, Document } from '@stageflip/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ClipElementProperties } from './clip-element-properties';
import { Hydrate, makeDoc, resetAtomCaches } from './test-helpers';

const labelSchema = z.object({
  label: z.string(),
  size: z.number().min(8).max(72),
});

function makeClip(kind: string, schema?: z.ZodType<unknown>): ClipDefinition<unknown> {
  const clip: ClipDefinition<unknown> = {
    kind,
    render: () => null,
  };
  if (schema) {
    (clip as { propsSchema?: z.ZodType<unknown> }).propsSchema = schema;
  }
  return clip;
}

function makeRuntime(id: string, clips: Array<ClipDefinition<unknown>>): ClipRuntime {
  return {
    id,
    tier: 'live',
    clips: new Map(clips.map((c) => [c.kind, c])),
  };
}

function makeClipElement(overrides: Partial<ClipElement> = {}): ClipElement {
  return {
    id: 'clip-1',
    transform: { x: 0, y: 0, width: 200, height: 80, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    type: 'clip',
    runtime: 'css',
    clipName: 'title-card',
    params: { label: 'Hello', size: 24 },
    ...overrides,
  };
}

function Snapshot({ onDoc }: { onDoc: (doc: Document | null) => void }): null {
  const { document } = useDocument();
  useEffect(() => {
    onDoc(document);
  }, [document, onDoc]);
  return null;
}

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  cleanup();
  resetAtomCaches();
  __clearRuntimeRegistry();
});

describe('<ClipElementProperties>', () => {
  it("renders ZodForm from the clip's propsSchema and writes commits back to params", () => {
    registerRuntime(makeRuntime('css', [makeClip('title-card', labelSchema)]));
    const element = makeClipElement();
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    const capture: { latest: Document | null } = { latest: null };
    const onDoc = (d: Document | null) => {
      capture.latest = d;
    };
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <Snapshot onDoc={onDoc} />
        <ClipElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );

    const labelInput = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    expect(labelInput.value).toBe('Hello');
    fireEvent.change(labelInput, { target: { value: 'World' } });
    fireEvent.blur(labelInput);

    const content = capture.latest?.content;
    expect(content?.mode).toBe('slide');
    if (content?.mode !== 'slide') throw new Error('expected slide mode');
    const next = content.slides[0]?.elements[0];
    expect(next?.type).toBe('clip');
    if (next?.type !== 'clip') throw new Error('expected clip element');
    expect(next.params).toEqual({ label: 'World', size: 24 });
  });

  it('shows the unknown-runtime notice when findClip returns null', () => {
    const element = makeClipElement({ clipName: 'missing' });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <ClipElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('clip-unknown-runtime')).toBeTruthy();
    expect(screen.queryByTestId('zodform-root')).toBeNull();
  });

  it('shows the no-schema notice when the clip carries no propsSchema', () => {
    registerRuntime(makeRuntime('css', [makeClip('title-card')]));
    const element = makeClipElement();
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <ClipElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    expect(screen.getByTestId('clip-no-schema')).toBeTruthy();
  });

  it('disables inputs when the element is locked', () => {
    registerRuntime(makeRuntime('css', [makeClip('title-card', labelSchema)]));
    const element = makeClipElement({ locked: true });
    const doc = makeDoc({ slideIds: ['slide-0'], elements: [element] });
    render(
      <DocumentProvider initialDocument={doc}>
        <Hydrate slideId="slide-0" elementId={element.id} />
        <ClipElementProperties slideId="slide-0" element={element} />
      </DocumentProvider>,
    );
    const labelInput = screen.getByTestId('zodform-field-label') as HTMLInputElement;
    expect(labelInput.disabled).toBe(true);
  });
});
