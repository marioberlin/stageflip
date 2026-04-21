// packages/cdp-host-bundle/src/composition.test.tsx
// Unit tests for the React composition renderer. Drives the
// component directly against happy-dom + React Testing Library —
// the browser-bundle IIFE is not involved. Integration tests of
// the compiled bundle live in renderer-cdp's reference-render e2e
// suite.
//
// Runtime registration is global state (handled by
// `@stageflip/runtimes-contract`). Each test clears the registry
// in `beforeEach` / `afterEach` so cases don't contaminate each
// other.

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import {
  type ClipDefinition,
  type ClipRuntime,
  __clearRuntimeRegistry,
  registerRuntime,
} from '@stageflip/runtimes-contract';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BootedComposition, Composition } from './composition';

function mkDoc(elements: RIRElement[], overrides: Partial<RIRDocument> = {}): RIRDocument {
  return {
    id: 'comp-test',
    width: 320,
    height: 240,
    frameRate: 30,
    durationFrames: 30,
    mode: 'slide',
    elements,
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'test',
    },
    ...overrides,
  };
}

function shapeEl(
  id: string,
  timing: { startFrame: number; endFrame: number },
  overrides: Partial<RIRElement> = {},
): RIRElement {
  return {
    id,
    type: 'shape',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { ...timing, durationFrames: timing.endFrame - timing.startFrame },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'shape', shape: 'rect', fill: '#336699' },
    ...overrides,
  } as RIRElement;
}

function textEl(id: string, text: string): RIRElement {
  return {
    id,
    type: 'text',
    transform: { x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 1,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'text',
      text,
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 600,
      color: '#ffffff',
      align: 'left',
      lineHeight: 1.2,
    },
  } as RIRElement;
}

function clipEl(id: string, runtime: string, clipName: string): RIRElement {
  return {
    id,
    type: 'clip',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'clip', runtime, clipName, params: {} },
  } as RIRElement;
}

function stubRuntime(
  id: string,
  kinds: readonly string[],
  textByKind: Record<string, string>,
): ClipRuntime {
  const clips = new Map<string, ClipDefinition<unknown>>();
  for (const kind of kinds) {
    clips.set(kind, {
      kind,
      render: () => <div data-testid={`rendered-${kind}`}>{textByKind[kind] ?? kind}</div>,
    });
  }
  return { id, tier: 'live', clips };
}

describe('Composition', () => {
  beforeEach(() => {
    __clearRuntimeRegistry();
  });
  afterEach(() => {
    __clearRuntimeRegistry();
  });

  it('renders a shape element with transform-derived CSS', () => {
    const doc = mkDoc([
      shapeEl(
        'bg',
        { startFrame: 0, endFrame: 30 },
        {
          transform: { x: 12, y: 34, width: 56, height: 78, rotation: 0, opacity: 0.8 },
        },
      ),
    ]);
    const { container } = render(<Composition document={doc} frame={0} />);
    const el = container.querySelector<HTMLElement>('[data-sf-el="bg"]');
    if (!el) throw new Error('expected shape node');
    expect(el.style.left).toBe('12px');
    expect(el.style.top).toBe('34px');
    expect(el.style.width).toBe('56px');
    expect(el.style.height).toBe('78px');
    expect(el.style.opacity).toBe('0.8');
  });

  it('renders a text element with individual font properties + text content', () => {
    const doc = mkDoc([textEl('title', 'Hello world')]);
    const { container } = render(<Composition document={doc} frame={5} />);
    const el = container.querySelector<HTMLElement>('[data-sf-el="title"]');
    if (!el) throw new Error('expected text node');
    expect(el.style.fontSize).toBe('24px');
    expect(el.style.fontWeight).toBe('600');
    expect(el.textContent).toBe('Hello world');
  });

  it('hides elements outside [startFrame, endFrame)', () => {
    const doc = mkDoc([
      shapeEl('early', { startFrame: 0, endFrame: 10 }),
      shapeEl('late', { startFrame: 20, endFrame: 30 }),
    ]);

    const { container, rerender } = render(<Composition document={doc} frame={5} />);
    let early = container.querySelector<HTMLElement>('[data-sf-el="early"]');
    let late = container.querySelector<HTMLElement>('[data-sf-el="late"]');
    expect(early?.style.display).not.toBe('none');
    expect(late?.style.display).toBe('none');

    rerender(<Composition document={doc} frame={25} />);
    early = container.querySelector<HTMLElement>('[data-sf-el="early"]');
    late = container.querySelector<HTMLElement>('[data-sf-el="late"]');
    expect(early?.style.display).toBe('none');
    expect(late?.style.display).not.toBe('none');
  });

  it('honours element.visible = false even inside the timing window', () => {
    const doc = mkDoc([shapeEl('hidden-el', { startFrame: 0, endFrame: 30 }, { visible: false })]);
    const { container } = render(<Composition document={doc} frame={10} />);
    const el = container.querySelector<HTMLElement>('[data-sf-el="hidden-el"]');
    expect(el?.style.display).toBe('none');
  });

  it('dispatches a clip element through findClip when the runtime is registered', () => {
    registerRuntime(stubRuntime('css', ['solid-background'], { 'solid-background': 'CSS-OUTPUT' }));
    const doc = mkDoc([clipEl('the-clip', 'css', 'solid-background')]);
    const { container } = render(<Composition document={doc} frame={0} />);
    const rendered = container.querySelector<HTMLElement>(
      '[data-testid="rendered-solid-background"]',
    );
    expect(rendered?.textContent).toBe('CSS-OUTPUT');
  });

  it('renders a labelled placeholder when the clip kind is unknown', () => {
    // No runtime registered for "mystery".
    const doc = mkDoc([clipEl('lost-clip', 'css', 'mystery')]);
    const { container } = render(<Composition document={doc} frame={0} />);
    const el = container.querySelector<HTMLElement>('[data-sf-el="lost-clip"]');
    expect(el?.textContent).toContain('CLIP lost-clip');
    expect(el?.querySelector('.__sf_placeholder')).toBeTruthy();
  });

  it('renders a labelled placeholder when the resolved runtime id does not match', () => {
    registerRuntime(
      stubRuntime('gsap', ['solid-background'], { 'solid-background': 'GSAP-OUTPUT' }),
    );
    const doc = mkDoc([clipEl('mismatched', 'css', 'solid-background')]);
    const { container } = render(<Composition document={doc} frame={0} />);
    const el = container.querySelector<HTMLElement>('[data-sf-el="mismatched"]');
    expect(el?.textContent).toContain('CLIP mismatched');
    expect(el?.textContent).toContain('(css:solid-background)');
  });

  it('stamps zIndex onto each element from RIR', () => {
    const doc = mkDoc([
      shapeEl('back', { startFrame: 0, endFrame: 30 }, { zIndex: 0 }),
      shapeEl('front', { startFrame: 0, endFrame: 30 }, { zIndex: 10 }),
    ]);
    const { container } = render(<Composition document={doc} frame={0} />);
    const back = container.querySelector<HTMLElement>('[data-sf-el="back"]');
    const front = container.querySelector<HTMLElement>('[data-sf-el="front"]');
    expect(back?.style.zIndex).toBe('0');
    expect(front?.style.zIndex).toBe('10');
  });

  it('sets root container dimensions from the document', () => {
    const doc = mkDoc([], { width: 1280, height: 720 });
    const { container } = render(<Composition document={doc} frame={0} />);
    const root = container.querySelector<HTMLElement>('[data-sf-composition]');
    expect(root?.style.width).toBe('1280px');
    expect(root?.style.height).toBe('720px');
  });

  it('stamps the current frame onto the root via data-sf-frame', () => {
    const doc = mkDoc([]);
    const { container, rerender } = render(<Composition document={doc} frame={0} />);
    expect(container.querySelector('[data-sf-composition]')?.getAttribute('data-sf-frame')).toBe(
      '0',
    );
    rerender(<Composition document={doc} frame={15} />);
    expect(container.querySelector('[data-sf-composition]')?.getAttribute('data-sf-frame')).toBe(
      '15',
    );
  });

  it('does NOT emit id="__sf_root" on its rendered root (host HTML owns that ID)', () => {
    // Regression guard for the duplicate-ID bug caught on PR #16:
    // Composition is mounted INTO a `<div id="__sf_root">` from the
    // host HTML, so its own output must not carry the same ID or
    // the live page would have two elements with it.
    const doc = mkDoc([]);
    const { container } = render(<Composition document={doc} frame={0} />);
    expect(container.querySelectorAll('#__sf_root')).toHaveLength(0);
    expect(container.querySelectorAll('[data-sf-composition]')).toHaveLength(1);
  });
});

describe('BootedComposition', () => {
  beforeEach(() => {
    __clearRuntimeRegistry();
  });
  afterEach(() => {
    __clearRuntimeRegistry();
  });

  it('wraps Composition in a FrameProvider so clips can read the frame context', () => {
    // The stub clip below reads nothing from context, but registering
    // a clip and rendering without a provider would still work today
    // because FrameContext only throws when a hook is called. The
    // useful assertion is that BootedComposition produces the same
    // DOM shape as Composition for a plain shape doc.
    const doc = mkDoc([shapeEl('bg', { startFrame: 0, endFrame: 30 })]);
    const { container } = render(<BootedComposition document={doc} frame={0} />);
    expect(container.querySelector('[data-sf-composition]')).toBeTruthy();
    expect(container.querySelector('[data-sf-el="bg"]')).toBeTruthy();
  });
});
